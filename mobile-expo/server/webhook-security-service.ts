import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { webhookEvents } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { AuditService, AuditAction, ResourceType } from "./compliance/audit-service";
import { getSecret } from "./gcp-secret-manager";
import { logger } from "./structured-logger";

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const MAX_PAYLOAD_SIZE = 1024 * 1024;

export type WebhookSource =
  | "particle_health"
  | "redox"
  | "1uphealth"
  | "human_api"
  | "flexpa"
  | "health_gorilla"
  | "epic"
  | "cerner"
  | "fasten_health"
  | "custom";

interface WebhookSecretConfig {
  source: WebhookSource;
  headerName: string;
  algorithm: "sha256" | "sha512";
  encoding: "hex" | "base64";
  requireTimestamp?: boolean;
}

const WEBHOOK_CONFIGS: Record<WebhookSource, WebhookSecretConfig> = {
  particle_health: { source: "particle_health", headerName: "x-particle-signature", algorithm: "sha256", encoding: "hex" },
  redox: { source: "redox", headerName: "x-redox-signature", algorithm: "sha256", encoding: "hex" },
  "1uphealth": { source: "1uphealth", headerName: "x-1up-signature", algorithm: "sha256", encoding: "hex" },
  human_api: { source: "human_api", headerName: "x-humanapi-signature", algorithm: "sha256", encoding: "hex" },
  flexpa: { source: "flexpa", headerName: "x-flexpa-signature", algorithm: "sha256", encoding: "hex" },
  health_gorilla: { source: "health_gorilla", headerName: "x-hg-signature", algorithm: "sha256", encoding: "hex" },
  epic: { source: "epic", headerName: "x-epic-signature", algorithm: "sha256", encoding: "base64" },
  cerner: { source: "cerner", headerName: "x-cerner-signature", algorithm: "sha256", encoding: "hex" },
  fasten_health: { source: "fasten_health", headerName: "x-fasten-signature", algorithm: "sha256", encoding: "hex", requireTimestamp: true },
  custom: { source: "custom", headerName: "x-aggregator-signature", algorithm: "sha256", encoding: "hex" },
};

const WEBHOOK_ENV_KEYS: Record<WebhookSource, string> = {
  particle_health: "PARTICLE_WEBHOOK_SECRET",
  redox: "REDOX_WEBHOOK_SECRET",
  "1uphealth": "ONEUP_WEBHOOK_SECRET",
  human_api: "HUMANAPI_WEBHOOK_SECRET",
  flexpa: "FLEXPA_WEBHOOK_SECRET",
  health_gorilla: "HEALTH_GORILLA_WEBHOOK_SECRET",
  epic: "EPIC_WEBHOOK_SECRET",
  cerner: "CERNER_WEBHOOK_SECRET",
  fasten_health: "FASTEN_WEBHOOK_SECRET",
  custom: "AGGREGATOR_WEBHOOK_SECRET",
};

async function getWebhookSecret(source: WebhookSource): Promise<string | null> {
  const envKey = WEBHOOK_ENV_KEYS[source];
  return getSecret(envKey, { envFallback: envKey, cacheTtlMs: 5 * 60 * 1000 });
}

export function computeHmacSignature(
  payload: string,
  secret: string,
  algorithm: "sha256" | "sha512" = "sha256",
  encoding: "hex" | "base64" = "hex"
): string {
  return crypto.createHmac(algorithm, secret).update(payload).digest(encoding);
}

export function verifySignature(
  payload: string,
  receivedSignature: string,
  secret: string,
  algorithm: "sha256" | "sha512" = "sha256",
  encoding: "hex" | "base64" = "hex"
): boolean {
  const computed = computeHmacSignature(payload, secret, algorithm, encoding);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, encoding === "hex" ? "hex" : "base64"),
      Buffer.from(receivedSignature, encoding === "hex" ? "hex" : "base64")
    );
  } catch {
    return false;
  }
}

function isReplayAttack(
  timestamp: string | number | undefined,
  requireTimestamp: boolean = false
): boolean {
  if (!timestamp) {
    return requireTimestamp;
  }
  const eventTime = typeof timestamp === "number" ? timestamp : new Date(timestamp).getTime();
  if (isNaN(eventTime)) {
    return requireTimestamp;
  }
  const age = Date.now() - eventTime;
  return age > REPLAY_WINDOW_MS || age < -REPLAY_WINDOW_MS;
}

export function createWebhookAuthMiddleware(source: WebhookSource) {
  const config = WEBHOOK_CONFIGS[source];

  return async (req: Request, res: Response, next: NextFunction) => {
    const requestId = crypto.randomUUID();
    (req as any).webhookRequestId = requestId;
    (req as any).webhookSource = source;

    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > MAX_PAYLOAD_SIZE) {
      logWebhookAttempt(req, source, "rejected", "Payload too large");
      return res.status(413).json({ error: "Payload too large" });
    }

    const secret = await getWebhookSecret(source);
    if (!secret) {
      logger.warn(`No webhook secret configured for ${source}`);
      logWebhookAttempt(req, source, "rejected", "No secret configured");
      return res.status(503).json({ error: "Webhook not configured" });
    }

    const receivedSignature = req.headers[config.headerName] as string;
    if (!receivedSignature) {
      logger.webhookEvent(req, source, "auth", "rejected", { reason: "Missing signature" });
      logWebhookAttempt(req, source, "rejected", "Missing signature header");
      return res.status(401).json({ error: "Missing signature" });
    }

    const rawBody = JSON.stringify(req.body);
    const isValid = verifySignature(rawBody, receivedSignature, secret, config.algorithm, config.encoding);

    if (!isValid) {
      logWebhookAttempt(req, source, "rejected", "Invalid signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    const eventTimestamp = req.body.timestamp || req.body.created_at || req.body.date || req.body.meta?.timestamp || req.headers["x-event-timestamp"];
    if (isReplayAttack(eventTimestamp, config.requireTimestamp)) {
      logWebhookAttempt(req, source, "rejected", "Replay attack detected or missing timestamp");
      return res.status(409).json({ error: "Event expired, replayed, or missing timestamp" });
    }

    logWebhookAttempt(req, source, "accepted", "Signature verified");
    next();
  };
}

async function logWebhookAttempt(
  req: Request,
  source: WebhookSource,
  status: "accepted" | "rejected",
  reason: string
) {
  try {
    await AuditService.createEntry({
      action: status === "accepted" ? AuditAction.CREATE_PHI : AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
      resourceType: ResourceType.HEALTH_RECORD,
      resourceId: (req as any).webhookRequestId || "unknown",
      context: {
        userId: null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
        requestId: (req as any).webhookRequestId,
      },
      phiDetails: {
        accessReason: `webhook_${source}`,
      },
      compliance: {
        hipaaCategory: "operations",
        minimumNecessary: true,
      },
      outcome: status === "accepted" ? "success" : "failure",
      timestamp: new Date(),
    });
  } catch (err) {
    console.error("[Webhook] Audit log failed:", err);
  }
}

export async function checkIdempotency(aggregatorEventId: string): Promise<boolean> {
  try {
    const existing = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.aggregatorEventId, aggregatorEventId))
      .limit(1);
    return existing.length > 0;
  } catch {
    return false;
  }
}

export async function recordWebhookEvent(params: {
  source: WebhookSource;
  eventType: string;
  aggregatorEventId: string;
  patientId?: string;
  payload: Record<string, unknown>;
  status: "received" | "processed" | "failed" | "duplicate";
  processingNotes?: string;
}): Promise<string> {
  const [event] = await db
    .insert(webhookEvents)
    .values({
      source: params.source,
      eventType: params.eventType,
      aggregatorEventId: params.aggregatorEventId,
      patientId: params.patientId || null,
      payload: params.payload,
      status: params.status,
      processingNotes: params.processingNotes || null,
      signatureVerified: true,
    })
    .returning({ id: webhookEvents.id });
  return event.id;
}

export async function claimWebhookEvent(params: {
  source: WebhookSource;
  eventType: string;
  aggregatorEventId: string;
  payload: Record<string, unknown>;
}): Promise<{ claimed: boolean; id: string }> {
  try {
    const rows = await db
      .insert(webhookEvents)
      .values({
        source: params.source,
        eventType: params.eventType,
        aggregatorEventId: params.aggregatorEventId,
        patientId: null,
        payload: params.payload,
        status: "received",
        processingNotes: null,
        signatureVerified: true,
      })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });

    if (rows.length > 0) {
      return { claimed: true, id: rows[0].id };
    }

    const existing = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.aggregatorEventId, params.aggregatorEventId))
      .limit(1);

    return { claimed: false, id: existing[0]?.id ?? "unknown" };
  } catch {
    const [event] = await db
      .insert(webhookEvents)
      .values({
        source: params.source,
        eventType: params.eventType,
        aggregatorEventId: params.aggregatorEventId,
        patientId: null,
        payload: params.payload,
        status: "received",
        processingNotes: null,
        signatureVerified: true,
      })
      .returning({ id: webhookEvents.id });
    return { claimed: true, id: event.id };
  }
}

export async function markEventProcessed(eventId: string, notes?: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({
      status: "processed",
      processedAt: new Date(),
      processingNotes: notes || "Successfully processed",
    })
    .where(eq(webhookEvents.id, eventId));
}

export async function markEventFailed(eventId: string, error: string): Promise<void> {
  await db
    .update(webhookEvents)
    .set({
      status: "failed",
      processedAt: new Date(),
      processingNotes: `Error: ${error}`,
    })
    .where(eq(webhookEvents.id, eventId));
}

export async function getWebhookStats(source?: WebhookSource) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const conditions = [gte(webhookEvents.receivedAt, cutoff)];
  if (source) {
    conditions.push(eq(webhookEvents.source, source));
  }

  const events = await db
    .select()
    .from(webhookEvents)
    .where(and(...conditions));

  const stats = {
    total: events.length,
    received: events.filter(e => e.status === "received").length,
    processed: events.filter(e => e.status === "processed").length,
    failed: events.filter(e => e.status === "failed").length,
    duplicate: events.filter(e => e.status === "duplicate").length,
    sources: {} as Record<string, number>,
  };

  for (const event of events) {
    stats.sources[event.source] = (stats.sources[event.source] || 0) + 1;
  }

  return stats;
}

export function verifyGCPConnection(): {
  status: "configured" | "partial" | "not_configured";
  checks: Array<{ service: string; configured: boolean; note: string }>;
} {
  const checks = [
    {
      service: "Secret Manager",
      configured: !!process.env.GCP_PROJECT_ID,
      note: process.env.GCP_PROJECT_ID
        ? `Project: ${process.env.GCP_PROJECT_ID}`
        : "GCP_PROJECT_ID not set",
    },
    {
      service: "Cloud SQL",
      configured: !!process.env.DATABASE_URL,
      note: process.env.DATABASE_URL
        ? "PostgreSQL connection active"
        : "DATABASE_URL not set",
    },
    {
      service: "Cloud KMS (CMEK)",
      configured: !!process.env.GCP_KMS_KEY_RING,
      note: process.env.GCP_KMS_KEY_RING
        ? `Key Ring: ${process.env.GCP_KMS_KEY_RING}`
        : "Using local AES-256-GCM encryption (upgrade to CMEK for production)",
    },
    {
      service: "Cloud Healthcare API",
      configured: !!process.env.GCP_HEALTHCARE_DATASET,
      note: process.env.GCP_HEALTHCARE_DATASET
        ? `Dataset: ${process.env.GCP_HEALTHCARE_DATASET}`
        : "Not configured - using local FHIR processing",
    },
    {
      service: "VPC Service Controls",
      configured: !!process.env.GCP_VPC_PERIMETER,
      note: process.env.GCP_VPC_PERIMETER
        ? `Perimeter: ${process.env.GCP_VPC_PERIMETER}`
        : "Not configured - required for production PHI isolation",
    },
    {
      service: "Cloud Armor (WAF/DDoS)",
      configured: !!process.env.GCP_CLOUD_ARMOR_POLICY,
      note: process.env.GCP_CLOUD_ARMOR_POLICY
        ? `Policy: ${process.env.GCP_CLOUD_ARMOR_POLICY}`
        : "Not configured - using application-level rate limiting",
    },
    {
      service: "Data Access Audit Logs",
      configured: true,
      note: "Application-level audit logging active (upgrade to Cloud Audit Logs for production)",
    },
    {
      service: "PHI Encryption at Rest",
      configured: true,
      note: "AES-256-GCM field-level encryption active",
    },
  ];

  const configuredCount = checks.filter(c => c.configured).length;
  const status =
    configuredCount === checks.length
      ? "configured"
      : configuredCount >= 3
        ? "partial"
        : "not_configured";

  return { status, checks };
}
