/**
 * Read-only fitness-app connections, via Terra.
 *
 * Every connection created here is read-only by construction: Terra's
 * widget auth flow never returns write access to the source platform, so
 * there's nothing this router can do to a patient's Fitbit/Garmin/Oura/
 * etc. account beyond reading the data categories the patient consented
 * to when they authorized the widget.
 *
 * Clinical-overlap readings (resting heart rate, weight, blood oxygen)
 * are written into vital_signs and run through the same abnormal-range
 * alerting as manually entered or RPM-device vitals — see
 * server/services/vital-thresholds.ts. Everything else (steps, sleep,
 * calories, HRV, workouts) is wellness data only, stored in
 * wellness_metrics, and never triggers a clinical alert.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import {
  fitnessConnectionsTable,
  wellnessMetricsTable,
  fitnessProviders,
  type FitnessProvider,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  generateWidgetSession,
  deauthenticateTerraUser,
  verifyTerraWebhookSignature,
  mapTerraPayloadToReadings,
  isTerraConfigured,
} from "../services/terra-integration-service";
import { ingestVitalReading } from "../services/vital-thresholds";

const router = Router();

function hashIdentifier(id: string): string {
  return id.slice(0, 8) + "***";
}

function logHipaaAudit(action: string, profileId: string | null, resourceId: string, details: string) {
  console.log(
    `[HIPAA-AUDIT][Fitness-Integrations] ${new Date().toISOString()} - ${action} - Profile:${profileId ? hashIdentifier(profileId) : "NONE"} - Resource:${resourceId} - ${details}`,
  );
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  (req as any).authenticatedUserId = sessionUserId;
  next();
}

// Webhook route is intentionally mounted before requireAuth — Terra calls
// it directly, with no patient session, authenticated only by signature.
router.post("/webhook", async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  const signature = req.header("terra-signature");

  if (!rawBody || !verifyTerraWebhookSignature(rawBody, signature)) {
    logHipaaAudit("WEBHOOK_SIGNATURE_REJECTED", null, "terra_webhook", "Invalid or missing terra-signature");
    return res.status(401).json({ success: false, error: "Invalid webhook signature" });
  }

  try {
    const { type, user, data } = req.body as { type?: string; user?: { user_id?: string }; data?: any[] };
    const terraUserId = user?.user_id;

    if (!terraUserId) {
      return res.status(200).json({ success: true, note: "No user_id on payload; ignored" });
    }

    const [connection] = await db
      .select()
      .from(fitnessConnectionsTable)
      .where(eq(fitnessConnectionsTable.terraUserId, terraUserId));

    if (!connection || connection.status === "disconnected") {
      // Connection was revoked on our side but Terra hasn't caught up yet
      // (or this is a stray/test webhook) — ack so Terra stops retrying,
      // but ingest nothing.
      return res.status(200).json({ success: true, note: "No active connection for this Terra user" });
    }

    let clinicalCount = 0;
    let wellnessCount = 0;

    for (const entry of data || []) {
      const { clinical, wellness } = mapTerraPayloadToReadings(type || "", entry);

      for (const reading of clinical) {
        await ingestVitalReading({
          profileId: connection.profileId,
          vitalType: reading.vitalType,
          value: reading.value,
          unit: reading.unit,
          recordedAt: reading.recordedAt,
          source: `terra_${connection.provider}`,
          deviceId: connection.id,
        });
        clinicalCount++;
      }

      for (const reading of wellness) {
        await db.insert(wellnessMetricsTable).values({
          profileId: connection.profileId,
          fitnessConnectionId: connection.id,
          provider: connection.provider,
          metricType: reading.metricType,
          value: reading.value.toString(),
          unit: reading.unit,
          recordedAt: reading.recordedAt,
        });
        wellnessCount++;
      }
    }

    await db
      .update(fitnessConnectionsTable)
      .set({ lastSyncAt: new Date() })
      .where(eq(fitnessConnectionsTable.id, connection.id));

    logHipaaAudit(
      "WEBHOOK_INGESTED",
      connection.profileId,
      connection.id,
      `type=${type} clinical=${clinicalCount} wellness=${wellnessCount}`,
    );

    res.status(200).json({ success: true, clinicalCount, wellnessCount });
  } catch (error) {
    console.error("[Fitness Integrations] Webhook processing error:", error);
    // Still 200 so Terra doesn't hammer retries on a processing bug on our
    // side; the error is logged for investigation.
    res.status(200).json({ success: false, error: "Webhook processing failed, logged for review" });
  }
});

router.use(requireAuth);

router.get("/providers", (_req: Request, res: Response) => {
  res.json({
    success: true,
    configured: isTerraConfigured(),
    providers: fitnessProviders.map((provider) => ({
      provider,
      readOnly: true,
    })),
  });
});

router.get("/connections", async (req: Request, res: Response) => {
  const profileId = (req as any).authenticatedUserId;
  const connections = await db
    .select()
    .from(fitnessConnectionsTable)
    .where(eq(fitnessConnectionsTable.profileId, profileId))
    .orderBy(desc(fitnessConnectionsTable.createdAt));

  logHipaaAudit("CONNECTIONS_READ", profileId, "fitness_connections", `Retrieved ${connections.length} connections`);

  res.json({ success: true, connections });
});

const connectSchema = z.object({
  provider: z.enum(fitnessProviders),
});

router.post("/connect", async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).authenticatedUserId;
    const { provider } = connectSchema.parse(req.body);

    if (!isTerraConfigured()) {
      return res.status(503).json({
        success: false,
        error:
          "Fitness app connections aren't configured yet. Set TERRA_API_KEY and TERRA_DEV_ID (from your Terra dashboard) to enable this.",
      });
    }

    const redirectBaseUrl = `${req.protocol}://${req.get("host")}/api/fitness/connect/callback`;
    const session = await generateWidgetSession(provider as FitnessProvider, profileId, redirectBaseUrl);

    const [connection] = await db
      .insert(fitnessConnectionsTable)
      .values({
        profileId,
        provider,
        terraSessionId: session.sessionId,
        status: "pending",
      })
      .returning();

    logHipaaAudit("CONNECTION_INITIATED", profileId, connection.id, `provider=${provider}`);

    res.status(201).json({
      success: true,
      connectionId: connection.id,
      widgetUrl: session.widgetUrl,
      expiresInSeconds: session.expiresInSeconds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid provider", details: error.errors });
    }
    console.error("[Fitness Integrations] Connect error:", error);
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to start connection" });
  }
});

// Terra redirects the patient's browser here after the widget flow. Terra
// identifies the connected user via the `user_id` query param and echoes
// back our `reference_id` (the profileId we passed in) plus our `state`
// (the session id) — see auth_success_redirect_url in generateWidgetSession.
router.get("/connect/callback", async (req: Request, res: Response) => {
  const profileId = (req as any).authenticatedUserId;
  const terraUserId = req.query.user_id as string | undefined;
  const status = req.query.status as string | undefined;

  try {
    const [connection] = await db
      .select()
      .from(fitnessConnectionsTable)
      .where(and(eq(fitnessConnectionsTable.profileId, profileId), eq(fitnessConnectionsTable.status, "pending")))
      .orderBy(desc(fitnessConnectionsTable.createdAt));

    if (!connection) {
      return res.redirect("/connections?fitness=error&reason=no_pending_connection");
    }

    if (status !== "success" || !terraUserId) {
      await db
        .update(fitnessConnectionsTable)
        .set({ status: "error", errorMessage: "User did not complete the Terra widget flow" })
        .where(eq(fitnessConnectionsTable.id, connection.id));
      return res.redirect("/connections?fitness=error");
    }

    await db
      .update(fitnessConnectionsTable)
      .set({ status: "connected", terraUserId, connectedAt: new Date(), lastSyncAt: new Date() })
      .where(eq(fitnessConnectionsTable.id, connection.id));

    logHipaaAudit("CONNECTION_COMPLETED", profileId, connection.id, `provider=${connection.provider}`);

    res.redirect("/connections?fitness=connected");
  } catch (error) {
    console.error("[Fitness Integrations] Callback error:", error);
    res.redirect("/connections?fitness=error");
  }
});

router.delete("/connections/:id", async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).authenticatedUserId;
    const { id } = req.params;

    const [connection] = await db.select().from(fitnessConnectionsTable).where(eq(fitnessConnectionsTable.id, id));
    if (!connection || connection.profileId !== profileId) {
      return res.status(404).json({ success: false, error: "Connection not found" });
    }

    if (connection.terraUserId) {
      const result = await deauthenticateTerraUser(connection.terraUserId);
      if (!result.success) {
        console.warn(`[Fitness Integrations] Terra deauth failed for ${connection.id}: ${result.error}`);
      }
    }

    await db
      .update(fitnessConnectionsTable)
      .set({ status: "disconnected", revokedAt: new Date() })
      .where(eq(fitnessConnectionsTable.id, id));

    logHipaaAudit("CONNECTION_REVOKED", profileId, id, `provider=${connection.provider}`);

    res.json({ success: true, message: "Disconnected" });
  } catch (error) {
    console.error("[Fitness Integrations] Disconnect error:", error);
    res.status(500).json({ success: false, error: "Failed to disconnect" });
  }
});

export default router;
