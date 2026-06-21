import type { Express, Request, Response } from "express";
import { createHash, randomUUID } from "crypto";
import type {
  AggregatorSyncRecord, InsertAggregatorSyncRecord,
  WebhookEvent, InsertWebhookEvent,
  WebhookConfig, AggregatorSource, AggregatorSyncStatus
} from "@shared/schema";
import { isSyncStale } from "@shared/schema";

const VALID_SOURCES: AggregatorSource[] = [
  "fasten_health", "cms_bluebutton"
];

const syncRecords: AggregatorSyncRecord[] = [
  {
    id: randomUUID(),
    patientId: "patient-002",
    aggregatorSource: "fasten_health",
    aggregatorRefId: "fh-ref-d4e5f6",
    lastSuccessfulSync: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    syncStatus: "completed",
    fingerprintHash: createHash("sha256").update("fh-patient-002-sync1").digest("hex"),
    errorMessage: null,
    retryCount: 0,
    nextRetryAt: null,
    webhookReceivedAt: new Date(Date.now() - 30.5 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: randomUUID(),
    patientId: "patient-004",
    aggregatorSource: "fasten_health",
    aggregatorRefId: "fh-ref-m4n5o6",
    lastSuccessfulSync: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    syncStatus: "syncing",
    fingerprintHash: createHash("sha256").update("cer-patient-004-sync1").digest("hex"),
    errorMessage: null,
    retryCount: 0,
    nextRetryAt: null,
    webhookReceivedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: randomUUID(),
    patientId: "patient-005",
    aggregatorSource: "cms_bluebutton",
    aggregatorRefId: "cms-ref-p7q8r9",
    lastSuccessfulSync: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    syncStatus: "idle",
    fingerprintHash: createHash("sha256").update("cms-patient-005-sync1").digest("hex"),
    errorMessage: null,
    retryCount: 0,
    nextRetryAt: null,
    webhookReceivedAt: null,
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
];

const webhookEvents: WebhookEvent[] = [
  {
    id: randomUUID(),
    source: "redox",
    eventType: "PatientUpdate",
    payload: { patientId: "patient-001", resourceType: "Patient", action: "update" },
    receivedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: "processed",
    fingerprintHash: createHash("sha256").update("redox-evt-001").digest("hex"),
    aggregatorRefId: "rdx-ref-a1b2c3",
    patientId: "patient-001",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    eventType: "LabResult",
    payload: { patientId: "patient-002", resourceType: "DiagnosticReport", action: "create" },
    receivedAt: new Date(Date.now() - 30.5 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
    status: "processed",
    fingerprintHash: createHash("sha256").update("hg-evt-002").digest("hex"),
    aggregatorRefId: "hg-ref-d4e5f6",
    patientId: "patient-002",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    eventType: "ClinicalNote",
    payload: { patientId: "patient-003", resourceType: "DocumentReference", action: "create" },
    receivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    processedAt: null,
    status: "failed",
    fingerprintHash: createHash("sha256").update("epic-evt-003").digest("hex"),
    aggregatorRefId: "epic-ref-g7h8i9",
    patientId: "patient-003",
    errorMessage: "Connection timeout after 30s",
    retryCount: 3,
  },
  {
    id: randomUUID(),
    source: "redox",
    eventType: "PatientUpdate",
    payload: { patientId: "patient-001", resourceType: "Patient", action: "update" },
    receivedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    status: "duplicate",
    fingerprintHash: createHash("sha256").update("redox-evt-001").digest("hex"),
    aggregatorRefId: "rdx-ref-a1b2c3",
    patientId: "patient-001",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "particle_health",
    eventType: "MedicationUpdate",
    payload: { patientId: "patient-001", resourceType: "MedicationRequest", action: "update" },
    receivedAt: new Date(Date.now() - 12.2 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    status: "processed",
    fingerprintHash: createHash("sha256").update("ph-evt-005").digest("hex"),
    aggregatorRefId: "ph-ref-j1k2l3",
    patientId: "patient-001",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    eventType: "Encounter",
    payload: { patientId: "patient-004", resourceType: "Encounter", action: "create" },
    receivedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    processedAt: null,
    status: "processing",
    fingerprintHash: createHash("sha256").update("cer-evt-006").digest("hex"),
    aggregatorRefId: "cer-ref-m4n5o6",
    patientId: "patient-004",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "cms_bluebutton",
    eventType: "ClaimUpdate",
    payload: { patientId: "patient-005", resourceType: "ExplanationOfBenefit", action: "update" },
    receivedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 47.5 * 60 * 60 * 1000).toISOString(),
    status: "processed",
    fingerprintHash: createHash("sha256").update("cms-evt-007").digest("hex"),
    aggregatorRefId: "cms-ref-p7q8r9",
    patientId: "patient-005",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    eventType: "ImmunizationRecord",
    payload: { patientId: "patient-002", resourceType: "Immunization", action: "create" },
    receivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 4.8 * 60 * 60 * 1000).toISOString(),
    status: "processed",
    fingerprintHash: createHash("sha256").update("hg-evt-008").digest("hex"),
    aggregatorRefId: "hg-ref-d4e5f6",
    patientId: "patient-002",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "redox",
    eventType: "AllergyUpdate",
    payload: { patientId: "patient-001", resourceType: "AllergyIntolerance", action: "create" },
    receivedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    processedAt: null,
    status: "received",
    fingerprintHash: createHash("sha256").update("redox-evt-009").digest("hex"),
    aggregatorRefId: "rdx-ref-a1b2c3",
    patientId: "patient-001",
    errorMessage: null,
    retryCount: 0,
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    eventType: "AppointmentScheduled",
    payload: { patientId: "patient-006", resourceType: "Appointment", action: "create" },
    receivedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    processedAt: new Date(Date.now() - 2.9 * 60 * 60 * 1000).toISOString(),
    status: "processed",
    fingerprintHash: createHash("sha256").update("athena-evt-010").digest("hex"),
    aggregatorRefId: "ath-ref-s1t2u3",
    patientId: "patient-006",
    errorMessage: null,
    retryCount: 0,
  },
];

const webhookConfigs: WebhookConfig[] = [
  {
    id: randomUUID(),
    source: "redox",
    endpointUrl: "/api/webhooks/redox",
    secret: process.env.WEBHOOK_SECRET_REDOX || "configure-in-env",
    enabled: true,
    eventTypes: ["PatientUpdate", "LabResult", "ClinicalNote", "AllergyUpdate", "MedicationUpdate"],
    lastHealthCheck: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    healthStatus: "healthy",
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    endpointUrl: "/api/webhooks/fasten_health",
    secret: process.env.WEBHOOK_SECRET_FASTEN_HEALTH || "configure-in-env",
    enabled: true,
    eventTypes: ["LabResult", "ImmunizationRecord", "DiagnosticReport"],
    lastHealthCheck: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    healthStatus: "healthy",
    createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    endpointUrl: "/api/webhooks/epic_ias",
    secret: process.env.WEBHOOK_SECRET_EPIC || "configure-in-env",
    enabled: true,
    eventTypes: ["ClinicalNote", "Encounter", "PatientUpdate"],
    lastHealthCheck: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    healthStatus: "degraded",
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    endpointUrl: "/api/webhooks/hospital-network",
    secret: process.env.WEBHOOK_SECRET_HOSPITAL || "configure-in-env",
    enabled: false,
    eventTypes: ["Encounter", "PatientUpdate"],
    lastHealthCheck: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    healthStatus: "unreachable",
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: randomUUID(),
    source: "fasten_health",
    endpointUrl: "/webhooks/fasten",
    secret: process.env.FASTEN_HEALTH_API_KEY || "configure-in-env",
    enabled: true,
    eventTypes: ["PatientUpdate", "LabResult", "ClinicalNote", "Encounter", "MedicationUpdate", "ImmunizationRecord", "AllergyUpdate", "DiagnosticReport"],
    lastHealthCheck: new Date().toISOString(),
    healthStatus: "healthy",
    createdAt: new Date().toISOString(),
  },
];

export function registerWebhookAggregatorRoutes(app: Express) {

  app.post("/webhooks/fasten", async (req: Request, res: Response) => {
    try {
      const fastenKey = process.env.FASTEN_HEALTH_API_KEY;
      if (fastenKey) {
        const signature = req.headers["x-webhook-signature"] || req.headers["x-fasten-signature"];
        if (signature) {
          const expectedSig = createHash("sha256")
            .update(JSON.stringify(req.body) + fastenKey)
            .digest("hex");
          if (signature !== expectedSig) {
            console.warn("[WebhookAggregator] Fasten Health HMAC verification failed");
          }
        }
      }

      const payload = req.body;
      const payloadStr = JSON.stringify(payload);
      const fingerprintHash = createHash("sha256").update(payloadStr).digest("hex");

      const duplicate = webhookEvents.find(
        (e) => e.fingerprintHash === fingerprintHash && e.source === "fasten_health"
      );

      if (duplicate) {
        console.log(`[WebhookAggregator] Fasten Health duplicate event hash=${fingerprintHash.substring(0, 12)}...`);
        return res.status(200).json({ success: true, status: "duplicate" });
      }

      const newEvent: WebhookEvent = {
        id: randomUUID(),
        source: "fasten_health",
        eventType: payload.eventType || payload.event_type || "Unknown",
        payload,
        receivedAt: new Date().toISOString(),
        processedAt: null,
        status: "received",
        fingerprintHash,
        aggregatorRefId: payload.aggregatorRefId || payload.reference_id || null,
        patientId: payload.patientId || payload.patient_id || null,
        errorMessage: null,
        retryCount: 0,
      };
      webhookEvents.push(newEvent);

      const patientId = payload.patientId || payload.patient_id;
      if (patientId) {
        const existingSync = syncRecords.find(
          (r) => r.patientId === patientId && r.aggregatorSource === "fasten_health"
        );

        if (existingSync) {
          existingSync.syncStatus = "syncing";
          existingSync.webhookReceivedAt = newEvent.receivedAt;
          existingSync.fingerprintHash = fingerprintHash;
          existingSync.updatedAt = new Date().toISOString();

          setTimeout(() => {
            existingSync.syncStatus = "completed";
            existingSync.lastSuccessfulSync = new Date().toISOString();
            existingSync.updatedAt = new Date().toISOString();
            newEvent.status = "processed";
            newEvent.processedAt = new Date().toISOString();
            console.log(`[WebhookAggregator] Fasten Health sync completed for patient=${patientId}`);
          }, 2000);
        } else {
          const newSync: AggregatorSyncRecord = {
            id: randomUUID(),
            patientId,
            aggregatorSource: "fasten_health",
            aggregatorRefId: payload.aggregatorRefId || payload.reference_id || randomUUID(),
            lastSuccessfulSync: null,
            syncStatus: "syncing",
            fingerprintHash,
            errorMessage: null,
            retryCount: 0,
            nextRetryAt: null,
            webhookReceivedAt: newEvent.receivedAt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          syncRecords.push(newSync);

          setTimeout(() => {
            newSync.syncStatus = "completed";
            newSync.lastSuccessfulSync = new Date().toISOString();
            newSync.updatedAt = new Date().toISOString();
            newEvent.status = "processed";
            newEvent.processedAt = new Date().toISOString();
            console.log(`[WebhookAggregator] Fasten Health initial sync completed for patient=${patientId}`);
          }, 2000);
        }
      }

      console.log(`[WebhookAggregator] Fasten Health event received eventType=${newEvent.eventType} id=${newEvent.id}`);
      return res.status(200).json({
        success: true,
        status: "received",
        eventId: newEvent.id,
        message: "Fasten Health webhook event received and sync triggered",
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error processing Fasten Health webhook:", error);
      return res.status(500).json({ error: "Failed to process Fasten Health webhook event" });
    }
  });

  app.post("/api/webhooks/:source", async (req: Request, res: Response) => {
    try {
      const { source } = req.params;

      if (!VALID_SOURCES.includes(source as AggregatorSource)) {
        return res.status(400).json({
          error: "Invalid aggregator source",
          validSources: VALID_SOURCES,
        });
      }

      const aggregatorSource = source as AggregatorSource;
      const payload = req.body;
      const payloadStr = JSON.stringify(payload);
      const fingerprintHash = createHash("sha256").update(payloadStr).digest("hex");

      const duplicate = webhookEvents.find(
        (e) => e.fingerprintHash === fingerprintHash && e.source === aggregatorSource
      );

      if (duplicate) {
        const dupEvent: WebhookEvent = {
          id: randomUUID(),
          source: aggregatorSource,
          eventType: payload.eventType || "Unknown",
          payload,
          receivedAt: new Date().toISOString(),
          processedAt: new Date().toISOString(),
          status: "duplicate",
          fingerprintHash,
          aggregatorRefId: payload.aggregatorRefId || null,
          patientId: payload.patientId || null,
          errorMessage: null,
          retryCount: 0,
        };
        webhookEvents.push(dupEvent);

        console.log(`[WebhookAggregator] Duplicate event detected for source=${aggregatorSource} hash=${fingerprintHash.substring(0, 12)}...`);
        return res.status(200).json({
          success: true,
          status: "duplicate",
          eventId: dupEvent.id,
          message: "Duplicate event detected; no sync triggered",
        });
      }

      const newEvent: WebhookEvent = {
        id: randomUUID(),
        source: aggregatorSource,
        eventType: payload.eventType || "Unknown",
        payload,
        receivedAt: new Date().toISOString(),
        processedAt: null,
        status: "received",
        fingerprintHash,
        aggregatorRefId: payload.aggregatorRefId || null,
        patientId: payload.patientId || null,
        errorMessage: null,
        retryCount: 0,
      };
      webhookEvents.push(newEvent);

      if (payload.patientId) {
        const existingSync = syncRecords.find(
          (r) => r.patientId === payload.patientId && r.aggregatorSource === aggregatorSource
        );

        if (existingSync) {
          existingSync.syncStatus = "syncing";
          existingSync.webhookReceivedAt = newEvent.receivedAt;
          existingSync.fingerprintHash = fingerprintHash;
          existingSync.updatedAt = new Date().toISOString();

          setTimeout(() => {
            existingSync.syncStatus = "completed";
            existingSync.lastSuccessfulSync = new Date().toISOString();
            existingSync.updatedAt = new Date().toISOString();
            newEvent.status = "processed";
            newEvent.processedAt = new Date().toISOString();
            console.log(`[WebhookAggregator] Sync completed for patient=${payload.patientId} source=${aggregatorSource}`);
          }, 2000);
        } else {
          const newSync: AggregatorSyncRecord = {
            id: randomUUID(),
            patientId: payload.patientId,
            aggregatorSource,
            aggregatorRefId: payload.aggregatorRefId || randomUUID(),
            lastSuccessfulSync: null,
            syncStatus: "syncing",
            fingerprintHash,
            errorMessage: null,
            retryCount: 0,
            nextRetryAt: null,
            webhookReceivedAt: newEvent.receivedAt,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          syncRecords.push(newSync);

          setTimeout(() => {
            newSync.syncStatus = "completed";
            newSync.lastSuccessfulSync = new Date().toISOString();
            newSync.updatedAt = new Date().toISOString();
            newEvent.status = "processed";
            newEvent.processedAt = new Date().toISOString();
            console.log(`[WebhookAggregator] Initial sync completed for patient=${payload.patientId} source=${aggregatorSource}`);
          }, 2000);
        }
      }

      console.log(`[WebhookAggregator] Event received source=${aggregatorSource} eventType=${newEvent.eventType} id=${newEvent.id}`);
      return res.status(200).json({
        success: true,
        status: "received",
        eventId: newEvent.id,
        message: "Webhook event received and sync triggered",
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error processing webhook:", error);
      return res.status(500).json({ error: "Failed to process webhook event" });
    }
  });

  app.get("/api/aggregator-sync/stats", async (req: Request, res: Response) => {
    try {
      const totalSyncs = syncRecords.length;
      const byStatus: Record<string, number> = {};
      const bySource: Record<string, number> = {};

      for (const record of syncRecords) {
        byStatus[record.syncStatus] = (byStatus[record.syncStatus] || 0) + 1;
        bySource[record.aggregatorSource] = (bySource[record.aggregatorSource] || 0) + 1;
      }

      const duplicateCount = webhookEvents.filter((e) => e.status === "duplicate").length;
      const totalWebhookEvents = webhookEvents.length;
      const failedEvents = webhookEvents.filter((e) => e.status === "failed").length;
      const staleRecords = syncRecords.filter((r) => isSyncStale(r.lastSuccessfulSync)).length;

      res.json({
        success: true,
        data: {
          totalSyncs,
          byStatus,
          bySource,
          duplicateCount,
          totalWebhookEvents,
          failedEvents,
          staleRecords,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error fetching sync stats:", error);
      res.status(500).json({ error: "Failed to fetch aggregator sync statistics" });
    }
  });

  app.get("/api/aggregator-sync/:patientId", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const records = syncRecords.filter((r) => r.patientId === patientId);

      const enriched = records.map((r) => ({
        ...r,
        isStale: isSyncStale(r.lastSuccessfulSync),
      }));

      res.json({
        success: true,
        data: enriched,
        total: enriched.length,
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error fetching patient sync records:", error);
      res.status(500).json({ error: "Failed to fetch patient sync records" });
    }
  });

  app.post("/api/aggregator-sync/:patientId/trigger", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const { force, source } = req.body;

      const patientRecords = syncRecords.filter(
        (r) => r.patientId === patientId && (!source || r.aggregatorSource === source)
      );

      if (patientRecords.length === 0) {
        return res.status(404).json({
          error: "No sync records found for patient",
          patientId,
        });
      }

      const triggered: string[] = [];
      const skipped: string[] = [];

      for (const record of patientRecords) {
        const stale = isSyncStale(record.lastSuccessfulSync);
        if (force || stale) {
          record.syncStatus = "syncing";
          record.updatedAt = new Date().toISOString();
          triggered.push(record.aggregatorSource);

          setTimeout(() => {
            record.syncStatus = "completed";
            record.lastSuccessfulSync = new Date().toISOString();
            record.updatedAt = new Date().toISOString();
            console.log(`[WebhookAggregator] Manual sync completed for patient=${patientId} source=${record.aggregatorSource}`);
          }, 3000);
        } else {
          skipped.push(record.aggregatorSource);
        }
      }

      res.json({
        success: true,
        data: {
          patientId,
          triggered,
          skipped,
          message: triggered.length > 0
            ? `Sync triggered for ${triggered.length} source(s)`
            : "All sources are up-to-date; use force=true to override",
        },
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error triggering sync:", error);
      res.status(500).json({ error: "Failed to trigger sync" });
    }
  });

  app.get("/api/aggregator-sync", async (req: Request, res: Response) => {
    try {
      const { patientId, source, status, page = "1", limit = "20" } = req.query;
      let filtered = [...syncRecords];

      if (patientId) {
        filtered = filtered.filter((r) => r.patientId === String(patientId));
      }
      if (source) {
        filtered = filtered.filter((r) => r.aggregatorSource === String(source));
      }
      if (status) {
        filtered = filtered.filter((r) => r.syncStatus === String(status));
      }

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const startIdx = (pageNum - 1) * limitNum;
      const paginated = filtered.slice(startIdx, startIdx + limitNum);

      res.json({
        success: true,
        data: paginated,
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filtered.length / limitNum),
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error listing sync records:", error);
      res.status(500).json({ error: "Failed to list aggregator sync records" });
    }
  });

  app.get("/api/webhooks/events", async (req: Request, res: Response) => {
    try {
      const { source, status, startDate, endDate, page = "1", limit = "20" } = req.query;
      let filtered = [...webhookEvents];

      if (source) {
        filtered = filtered.filter((e) => e.source === String(source));
      }
      if (status) {
        filtered = filtered.filter((e) => e.status === String(status));
      }
      if (startDate) {
        const start = new Date(String(startDate)).getTime();
        filtered = filtered.filter((e) => new Date(e.receivedAt).getTime() >= start);
      }
      if (endDate) {
        const end = new Date(String(endDate)).getTime();
        filtered = filtered.filter((e) => new Date(e.receivedAt).getTime() <= end);
      }

      filtered.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
      const startIdx = (pageNum - 1) * limitNum;
      const paginated = filtered.slice(startIdx, startIdx + limitNum);

      res.json({
        success: true,
        data: paginated,
        total: filtered.length,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(filtered.length / limitNum),
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error listing webhook events:", error);
      res.status(500).json({ error: "Failed to list webhook events" });
    }
  });

  app.get("/api/webhooks/config", async (_req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: webhookConfigs,
        total: webhookConfigs.length,
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error fetching webhook configs:", error);
      res.status(500).json({ error: "Failed to fetch webhook configurations" });
    }
  });

  app.post("/api/webhooks/config", async (req: Request, res: Response) => {
    try {
      const { source, endpointUrl, secret, enabled, eventTypes } = req.body;

      if (!source || !VALID_SOURCES.includes(source as AggregatorSource)) {
        return res.status(400).json({
          error: "Invalid or missing aggregator source",
          validSources: VALID_SOURCES,
        });
      }
      if (!endpointUrl) {
        return res.status(400).json({ error: "endpointUrl is required" });
      }

      const existing = webhookConfigs.find((c) => c.source === source);

      if (existing) {
        existing.endpointUrl = endpointUrl || existing.endpointUrl;
        existing.secret = secret || existing.secret;
        existing.enabled = enabled !== undefined ? enabled : existing.enabled;
        existing.eventTypes = eventTypes || existing.eventTypes;
        existing.lastHealthCheck = new Date().toISOString();
        existing.healthStatus = "healthy";

        console.log(`[WebhookAggregator] Updated webhook config for source=${source}`);
        return res.json({
          success: true,
          data: existing,
          message: "Webhook configuration updated",
        });
      }

      const newConfig: WebhookConfig = {
        id: randomUUID(),
        source: source as AggregatorSource,
        endpointUrl,
        secret: secret || `${source}_wh_secret_${randomUUID().substring(0, 8)}`,
        enabled: enabled !== undefined ? enabled : true,
        eventTypes: eventTypes || [],
        lastHealthCheck: new Date().toISOString(),
        healthStatus: "healthy",
        createdAt: new Date().toISOString(),
      };
      webhookConfigs.push(newConfig);

      console.log(`[WebhookAggregator] Created webhook config for source=${source}`);
      return res.status(201).json({
        success: true,
        data: newConfig,
        message: "Webhook configuration created",
      });
    } catch (error) {
      console.error("[WebhookAggregator] Error saving webhook config:", error);
      res.status(500).json({ error: "Failed to save webhook configuration" });
    }
  });
}
