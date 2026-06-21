import { Router, Request, Response } from "express";
import { z } from "zod";
import * as integrationHub from "./services/external-integration-hub";
import * as hl7Handler from "./services/hl7-v2-handler";
import * as reconciliation from "./services/data-reconciliation-service";
import { requireRole } from "./rbac";
import { requireConsents } from "./consent/consent-enforcement";

const router = Router();

function getRequestInfo(req: Request): { userId: string; ipAddress: string } {
  const user = (req as any).user;
  return {
    userId: user?.id || "anonymous",
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
  };
}

router.get("/connections",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const connections = integrationHub.getConnections();
      res.json({ success: true, connections });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/connections/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const connection = integrationHub.getConnection(req.params.id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true, connection });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const createConnectionSchema = z.object({
  name: z.string(),
  type: z.enum(["ehr", "hie", "lab", "pharmacy", "payer", "registry", "legacy"]),
  endpoint: z.string(),
  authType: z.enum(["oauth2", "mtls", "api_key", "smart_on_fhir", "basic"]),
  syncDirection: z.enum(["inbound", "outbound", "bidirectional"]),
  supportedFormats: z.array(z.enum(["fhir_r4", "hl7_v2", "ccd", "ccda", "custom"])),
  supportedResources: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/connections",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = createConnectionSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const connection = await integrationHub.createConnection(
        {
          ...validation.data,
          metadata: validation.data.metadata || {},
          credentials: {},
          rateLimits: {
            requestsPerMinute: 100,
            requestsPerHour: 1000,
            burstLimit: 20,
            currentMinuteCount: 0,
            currentHourCount: 0,
            lastResetMinute: new Date().toISOString(),
            lastResetHour: new Date().toISOString(),
          },
        },
        userId,
        ipAddress
      );

      res.status(201).json({ success: true, connection });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/connections/:id/test",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const result = await integrationHub.testConnection(req.params.id, userId, ipAddress);
      res.json({ ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete("/connections/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const deleted = await integrationHub.deleteConnection(req.params.id, userId, ipAddress);
      if (!deleted) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true, message: "Connection deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/webhooks",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const connectionId = req.query.connectionId as string | undefined;
      const subscriptions = integrationHub.getWebhookSubscriptions(connectionId);
      res.json({ success: true, subscriptions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const createWebhookSchema = z.object({
  connectionId: z.string(),
  eventTypes: z.array(z.string()),
  callbackUrl: z.string().url(),
  secret: z.string(),
  retryPolicy: z.object({
    maxRetries: z.number(),
    backoffMultiplier: z.number(),
    initialDelayMs: z.number(),
    maxDelayMs: z.number(),
  }).optional(),
});

router.post("/webhooks",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const validation = createWebhookSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const subscription = await integrationHub.createWebhookSubscription(
        {
          ...validation.data,
          status: "active",
          retryPolicy: validation.data.retryPolicy || {
            maxRetries: 3,
            backoffMultiplier: 2,
            initialDelayMs: 1000,
            maxDelayMs: 30000,
          },
        },
        userId,
        ipAddress
      );

      res.status(201).json({ success: true, subscription });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.delete("/webhooks/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const deleted = await integrationHub.deleteWebhookSubscription(req.params.id, userId, ipAddress);
      if (!deleted) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }
      res.json({ success: true, message: "Webhook deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/sync-events",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const connectionId = req.query.connectionId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
      const events = integrationHub.getSyncEvents(connectionId, limit);
      res.json({ success: true, events });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/transform-rules",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const format = req.query.format as integrationHub.MessageFormat | undefined;
      const rules = integrationHub.getTransformRules(format);
      res.json({ success: true, rules });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/stats",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const stats = integrationHub.getIntegrationStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/hl7/receive",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const { message } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const result = await hl7Handler.processHL7Message(message, userId, ipAddress);

      res.json({
        success: result.success,
        message: result.message,
        fhirResources: result.fhirResources,
        ack: result.ack,
        errors: result.errors,
        compliance: {
          hipaaAuditLogging: "ENABLED",
          phiProtection: "ACTIVE",
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/hl7/messages",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = hl7Handler.getReceivedMessages(limit);
      res.json({ success: true, messages });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/hl7/messages/:id",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const message = hl7Handler.getMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json({ success: true, message });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/hl7/stats",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const stats = hl7Handler.getHL7Stats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/reconciliation/matches",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const matches = reconciliation.getMatchResults(status);
      res.json({ success: true, matches });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/reconciliation/matches/:id",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const match = reconciliation.getMatchResult(req.params.id);
      if (!match) {
        return res.status(404).json({ error: "Match result not found" });
      }
      res.json({ success: true, match });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

const resolveMatchSchema = z.object({
  resolution: z.enum(["accept_suggested", "manual", "reject"]),
  manualMerge: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

router.post("/reconciliation/matches/:id/resolve",
  requireRole("admin", "provider"),
  requireConsents,
  async (req: Request, res: Response) => {
    try {
      const validation = resolveMatchSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const result = await reconciliation.resolveMatch(
        req.params.id,
        validation.data.resolution,
        validation.data.manualMerge,
        userId,
        ipAddress,
        validation.data.notes
      );

      if (!result) {
        return res.status(404).json({ error: "Match result not found" });
      }

      res.json({
        success: true,
        result,
        compliance: {
          hipaaAuditLogging: "ENABLED",
          phiProtection: "ACTIVE",
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/reconciliation/rules",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const rules = reconciliation.getMergeRules();
      res.json({ success: true, rules });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/reconciliation/duplicate-groups",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const groups = reconciliation.getDuplicateGroups(status);
      res.json({ success: true, groups });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/reconciliation/stats",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const stats = reconciliation.getReconciliationStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/auth-types",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      authTypes: [
        {
          id: "oauth2",
          name: "OAuth 2.0",
          description: "Standard OAuth 2.0 authorization flow",
          fields: ["clientId", "clientSecret", "tokenEndpoint", "scopes"],
          hipaaCompliant: true,
        },
        {
          id: "mtls",
          name: "Mutual TLS (mTLS)",
          description: "Certificate-based mutual authentication",
          fields: ["clientCert", "clientKey", "caCert"],
          hipaaCompliant: true,
          recommended: true,
        },
        {
          id: "smart_on_fhir",
          name: "SMART on FHIR",
          description: "Healthcare-specific OAuth 2.0 with PKCE",
          fields: ["clientId", "clientSecret", "authEndpoint", "tokenEndpoint", "scopes"],
          hipaaCompliant: true,
          recommended: true,
        },
        {
          id: "api_key",
          name: "API Key",
          description: "Simple API key authentication",
          fields: ["apiKey", "headerName"],
          hipaaCompliant: true,
          note: "Recommended only for low-sensitivity endpoints",
        },
        {
          id: "basic",
          name: "Basic Auth",
          description: "Username/password authentication",
          fields: ["username", "password"],
          hipaaCompliant: false,
          note: "Not recommended for production - use only with TLS",
        },
      ],
    });
  }
);

router.get("/supported-formats",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    res.json({
      success: true,
      formats: [
        {
          id: "fhir_r4",
          name: "FHIR R4",
          description: "HL7 FHIR Release 4",
          mimeType: "application/fhir+json",
          standard: "HL7 FHIR",
        },
        {
          id: "hl7_v2",
          name: "HL7 v2.x",
          description: "HL7 Version 2 messages (2.3-2.8)",
          mimeType: "text/plain",
          standard: "HL7 v2",
          legacySupport: true,
        },
        {
          id: "ccd",
          name: "CCD",
          description: "Continuity of Care Document",
          mimeType: "application/xml",
          standard: "HL7 CDA",
        },
        {
          id: "ccda",
          name: "C-CDA",
          description: "Consolidated CDA",
          mimeType: "application/xml",
          standard: "HL7 CDA R2.1",
        },
        {
          id: "custom",
          name: "Custom Format",
          description: "Proprietary or custom data format",
          mimeType: "application/json",
          note: "Requires custom transformation rules",
        },
      ],
    });
  }
);

export default router;
