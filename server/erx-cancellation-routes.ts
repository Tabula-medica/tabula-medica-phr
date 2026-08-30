/**
 * eRx cancellation API.
 *
 * Mounted at `/api/erx-cancellation`. Covers the three cancellation triggers
 * (dose change, manual cancellation, patient demise), the pharmacy response
 * webhook, and the waste-avoidance reporting the feature exists to produce.
 *
 * Auth mirrors `medication-management-routes.ts`: session-bound, with an
 * explicit guard that a caller cannot name a profile other than their own.
 */

import { Router, type NextFunction, type Request, type Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import {
  createErxCancellationSchema,
  erxCancellationStatuses,
  erxCancellationTriggers,
  recordPatientMortalitySchema,
  rescindPatientMortalitySchema,
  type ErxCancellationStatus,
  type ErxCancellationTrigger,
} from "@shared/schema";
import { logger } from "./lib/logger";
import {
  approveCancellationRequest,
  createCancellationRequest,
  getCancellationEvents,
  getCancellationRequest,
  getMortalityRecord,
  getQueueHealth,
  getWasteSavingsSummary,
  listCancellationRequests,
  processPendingTransmissions,
  recordCancelRxResponse,
  recordPatientMortality,
  rescindPatientMortality,
  transmitCancellationRequest,
  verifyPatientMortality,
  withdrawCancellationRequest,
} from "./services/erx-cancellation-service";

const router = Router();

function hashIdentifier(id: string): string {
  return `${id.slice(0, 8)}***`;
}

function logAudit(action: string, details: Record<string, unknown>): void {
  logger.info({ component: "ErxCancelRoutes", audit: "HIPAA", action, details }, "HIPAA audit event");
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req.session as any)?.userId;
  if (!sessionUserId) {
    logAudit("UNAUTHORIZED_ACCESS", { path: req.path, method: req.method });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  (req as any).authenticatedUserId = sessionUserId;
  next();
}

/** Reject any request that names a profile other than the session's own. */
function enforceSessionUserId(req: Request, res: Response, next: NextFunction) {
  const sessionUserId = (req as any).authenticatedUserId;
  const candidates = [
    req.query.profileId as string | undefined,
    req.body?.profileId,
    req.params?.profileId,
  ];

  const mismatch = candidates.find((c) => c && c !== sessionUserId);
  if (mismatch) {
    logAudit("ACCESS_DENIED", {
      userId: hashIdentifier(sessionUserId),
      attemptedAccess: hashIdentifier(mismatch),
      path: req.path,
    });
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  (req as any).userId = sessionUserId;
  next();
}

/**
 * Webhook auth for inbound CancelRxResponse messages. The gateway signs with a
 * shared secret; without `ERX_WEBHOOK_SECRET` configured the endpoint is closed
 * rather than open, so an unconfigured deployment cannot be spoofed.
 */
function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ERX_WEBHOOK_SECRET;
  if (!expected) {
    logger.error({ component: "ErxCancelRoutes" }, "ERX_WEBHOOK_SECRET is not configured");
    return res.status(503).json({ success: false, error: "Webhook endpoint is not configured" });
  }

  const provided = req.header("x-erx-webhook-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    logAudit("WEBHOOK_AUTH_FAILED", { path: req.path });
    return res.status(401).json({ success: false, error: "Invalid webhook credentials" });
  }
  next();
}

/** Admin-only guard for the queue operations endpoints. */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;
  if (session?.role !== "admin" && session?.role !== "superadmin") {
    logAudit("ADMIN_ACCESS_DENIED", { path: req.path });
    return res.status(403).json({ success: false, error: "Administrator access required" });
  }
  next();
}

/** Repo convention for identifying a clinician session. */
function isProviderSession(req: Request): boolean {
  const session = req.session as any;
  return Boolean(session?.isProvider) || session?.role === "provider" || session?.role === "prescriber";
}

/**
 * Derive the initiator role from the session rather than the request body.
 * Only a clinician session may create a self-approving cancellation; anything
 * else is a patient request that waits for a prescriber.
 */
function resolveInitiatorRole(req: Request): "prescriber" | "patient" {
  return isProviderSession(req) ? "prescriber" : "patient";
}

/** Guard for endpoints that stand in for a prescriber's signature. */
function requirePrescriber(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;
  if (!isProviderSession(req) && session?.role !== "admin") {
    logAudit("PRESCRIBER_ACTION_DENIED", { path: req.path });
    return res.status(403).json({
      success: false,
      error: "Only a prescriber may approve a prescription cancellation",
    });
  }
  next();
}

function zodErrorResponse(res: Response, error: z.ZodError) {
  return res.status(400).json({
    success: false,
    error: "Validation failed",
    details: error.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
  });
}

const DISCLAIMER =
  "Cancellation requests are transmitted to the pharmacy as NCPDP SCRIPT CancelRx messages. " +
  "A pharmacy may decline a cancellation, for example when the prescription has already been " +
  "dispensed. Confirm directly with the pharmacy before relying on a cancellation.";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

router.get("/metadata", (_req: Request, res: Response) => {
  res.json({
    name: "eRx Cancellation & Auto-Discontinuation",
    version: "1.0.0",
    messageStandard: "NCPDP SCRIPT CancelRx",
    triggers: erxCancellationTriggers,
    statuses: erxCancellationStatuses,
    disclaimer: DISCLAIMER,
  });
});

// ---------------------------------------------------------------------------
// Cancellation requests
// ---------------------------------------------------------------------------

router.get("/requests", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId as string;
    const status = req.query.status as ErxCancellationStatus | undefined;
    const triggerType = req.query.triggerType as ErxCancellationTrigger | undefined;

    if (status && !erxCancellationStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Unknown status filter" });
    }
    if (triggerType && !erxCancellationTriggers.includes(triggerType)) {
      return res.status(400).json({ success: false, error: "Unknown trigger filter" });
    }

    const limit = Number.parseInt((req.query.limit as string) ?? "", 10);
    const requests = await listCancellationRequests(profileId, {
      status,
      triggerType,
      limit: Number.isFinite(limit) ? limit : undefined,
    });

    res.json({ success: true, requests, count: requests.length, disclaimer: DISCLAIMER });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to list cancellation requests");
    res.status(500).json({ success: false, error: "Failed to list cancellation requests" });
  }
});

router.post("/requests", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId as string;
    const parsed = createErxCancellationSchema.safeParse(req.body);
    if (!parsed.success) return zodErrorResponse(res, parsed.error);

    const result = await createCancellationRequest({
      profileId,
      ...parsed.data,
      initiatedBy: profileId,
      initiatorRole: resolveInitiatorRole(req),
    });

    logAudit("ERX_CANCELLATION_REQUESTED", {
      profileId: hashIdentifier(profileId),
      trigger: parsed.data.triggerType,
      deduplicated: !result.created,
    });

    res.status(result.created ? 201 : 200).json({
      success: true,
      request: result.request,
      created: result.created,
      // A patient-initiated request waits for a prescriber; say so plainly
      // rather than letting the caller assume the pharmacy has been told.
      message: result.request.requiresPrescriberApproval
        ? "Cancellation request created and is awaiting prescriber approval. Nothing has been sent to the pharmacy yet."
        : "Cancellation request created and queued for transmission to the pharmacy.",
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to create cancellation request");
    res.status(500).json({ success: false, error: "Failed to create cancellation request" });
  }
});

/** Load a request and confirm it belongs to the session's profile. */
async function loadOwnedRequest(req: Request, res: Response) {
  const profileId = (req as any).userId as string;
  const request = await getCancellationRequest(req.params.requestId);
  if (!request || request.profileId !== profileId) {
    // Same response for "missing" and "someone else's" so the endpoint cannot
    // be used to probe for the existence of other patients' records.
    res.status(404).json({ success: false, error: "Cancellation request not found" });
    return null;
  }
  return request;
}

router.get(
  "/requests/:requestId",
  requireAuth,
  enforceSessionUserId,
  async (req: Request, res: Response) => {
    try {
      const request = await loadOwnedRequest(req, res);
      if (!request) return;
      const events = await getCancellationEvents(request.id);
      res.json({ success: true, request, events, disclaimer: DISCLAIMER });
    } catch (error) {
      logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to fetch cancellation request");
      res.status(500).json({ success: false, error: "Failed to fetch cancellation request" });
    }
  },
);

router.post(
  "/requests/:requestId/approve",
  requireAuth,
  requirePrescriber,
  enforceSessionUserId,
  async (req: Request, res: Response) => {
    try {
      const request = await loadOwnedRequest(req, res);
      if (!request) return;

      // The approver is the authenticated session, never a body field — a
      // client-supplied name would make the approval audit trail worthless.
      const approver = (req as any).authenticatedUserId as string;
      const updated = await approveCancellationRequest(request.id, approver);
      res.json({ success: true, request: updated, disclaimer: DISCLAIMER });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to approve request";
      logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to approve cancellation request");
      res.status(400).json({ success: false, error: message });
    }
  },
);

router.post(
  "/requests/:requestId/transmit",
  requireAuth,
  enforceSessionUserId,
  async (req: Request, res: Response) => {
    try {
      const request = await loadOwnedRequest(req, res);
      if (!request) return;
      const updated = await transmitCancellationRequest(request.id);
      res.json({ success: true, request: updated, disclaimer: DISCLAIMER });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to transmit request";
      logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to transmit cancellation request");
      res.status(400).json({ success: false, error: message });
    }
  },
);

router.post(
  "/requests/:requestId/withdraw",
  requireAuth,
  enforceSessionUserId,
  async (req: Request, res: Response) => {
    try {
      const request = await loadOwnedRequest(req, res);
      if (!request) return;
      const updated = await withdrawCancellationRequest(
        request.id,
        (req as any).userId,
        req.body?.reason,
      );
      res.json({ success: true, request: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to withdraw request";
      res.status(400).json({ success: false, error: message });
    }
  },
);

// ---------------------------------------------------------------------------
// Waste-avoidance reporting
// ---------------------------------------------------------------------------

router.get("/savings", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const summary = await getWasteSavingsSummary((req as any).userId);
    res.json({
      success: true,
      summary,
      note:
        "Figures are estimates from average per-day acquisition costs, not billed amounts. " +
        "Confirmed savings count only cancellations a pharmacy acknowledged before dispensing.",
    });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to build savings summary");
    res.status(500).json({ success: false, error: "Failed to build savings summary" });
  }
});

// ---------------------------------------------------------------------------
// Patient mortality
// ---------------------------------------------------------------------------

router.get("/mortality", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const record = await getMortalityRecord((req as any).userId);
    res.json({ success: true, record: record ?? null });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to fetch mortality record");
    res.status(500).json({ success: false, error: "Failed to fetch mortality record" });
  }
});

router.post("/mortality", requireAuth, enforceSessionUserId, async (req: Request, res: Response) => {
  try {
    const profileId = (req as any).userId as string;
    const parsed = recordPatientMortalitySchema.safeParse(req.body);
    if (!parsed.success) return zodErrorResponse(res, parsed.error);

    // Only a clinician or admin session may assert an authoritative source. A
    // patient/caregiver session claiming "clinician_attested" would cancel every
    // prescription unattended on nothing but its own say-so, so those reports
    // are recorded as what they actually are and held for verification.
    const clinicianSession = isProviderSession(req) || (req.session as any)?.role === "admin";
    const source = clinicianSession
      ? parsed.data.source
      : parsed.data.source === "caregiver_reported"
        ? "caregiver_reported"
        : "family_reported";

    if (source !== parsed.data.source) {
      logAudit("MORTALITY_SOURCE_DOWNGRADED", {
        profileId: hashIdentifier(profileId),
        claimed: parsed.data.source,
        recorded: source,
      });
    }

    const result = await recordPatientMortality({
      profileId,
      ...parsed.data,
      source,
      actor: (req as any).authenticatedUserId as string,
    });

    res.status(201).json({
      success: true,
      record: result.record,
      batchId: result.batchId,
      cancellationsCreated: result.cancellationsCreated,
      medicationsConsidered: result.medicationsConsidered,
      heldForVerification: result.heldForVerification,
      message: result.heldForVerification
        ? "Death report recorded and held for verification. No prescriptions have been cancelled yet."
        : `Death report recorded. ${result.cancellationsCreated} prescription cancellation(s) queued for the pharmacy.`,
      disclaimer: DISCLAIMER,
    });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to record mortality");
    res.status(500).json({ success: false, error: "Failed to record death report" });
  }
});

router.post(
  "/mortality/verify",
  requireAuth,
  requirePrescriber,
  enforceSessionUserId,
  async (req: Request, res: Response) => {
    try {
      const profileId = (req as any).userId as string;
      const result = await verifyPatientMortality(
        profileId,
        (req as any).authenticatedUserId as string,
      );
      res.json({
        success: true,
        record: result.record,
        batchId: result.batchId,
        cancellationsCreated: result.cancellationsCreated,
        disclaimer: DISCLAIMER,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to verify death report";
      res.status(400).json({ success: false, error: message });
    }
  },
);

router.post(
  "/mortality/rescind",
  requireAuth,
  enforceSessionUserId,
  async (req: Request, res: Response) => {
    try {
      const profileId = (req as any).userId as string;
      const parsed = rescindPatientMortalitySchema.safeParse(req.body);
      if (!parsed.success) return zodErrorResponse(res, parsed.error);

      // Rescinding is deliberately NOT gated behind a clinician: an erroneous
      // death report must be reversible by whoever notices it.
      const result = await rescindPatientMortality({
        profileId,
        rescindedBy: (req as any).authenticatedUserId as string,
        rescindReason: parsed.data.rescindReason,
      });

      res.json({
        success: true,
        record: result.record,
        withdrawn: result.withdrawn,
        alreadyTransmitted: result.alreadyTransmitted.map((r) => ({
          id: r.id,
          medicationName: r.medicationName,
          pharmacyName: r.pharmacyName,
          status: r.status,
        })),
        message:
          result.alreadyTransmitted.length > 0
            ? `Death report rescinded. ${result.withdrawn} cancellation(s) withdrawn, but ${result.alreadyTransmitted.length} had already reached the pharmacy and must be resolved by phone.`
            : `Death report rescinded. ${result.withdrawn} cancellation(s) withdrawn before transmission.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rescind death report";
      res.status(400).json({ success: false, error: message });
    }
  },
);

// ---------------------------------------------------------------------------
// Inbound pharmacy responses
// ---------------------------------------------------------------------------

const cancelRxResponseSchema = z.object({
  scriptMessageId: z.string().min(1),
  responseStatus: z.string().min(1),
  denialCode: z.string().max(10).optional().nullable(),
  denialText: z.string().max(500).optional().nullable(),
});

router.post("/webhooks/cancel-rx-response", requireWebhookSecret, async (req: Request, res: Response) => {
  try {
    const parsed = cancelRxResponseSchema.safeParse(req.body);
    if (!parsed.success) return zodErrorResponse(res, parsed.error);

    const updated = await recordCancelRxResponse(parsed.data);
    if (!updated) {
      // Never acknowledged silently: an unmatched response means a real
      // cancellation is unaccounted for on one side of the connection.
      logger.warn(
        { component: "ErxCancelRoutes", scriptMessageId: parsed.data.scriptMessageId },
        "CancelRxResponse did not match any known request",
      );
      return res.status(404).json({ success: false, error: "No cancellation request matches that message id" });
    }

    res.json({ success: true, status: updated.status });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to process CancelRxResponse");
    res.status(500).json({ success: false, error: "Failed to process pharmacy response" });
  }
});

// ---------------------------------------------------------------------------
// Queue operations
// ---------------------------------------------------------------------------

router.get("/admin/queue-health", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const health = await getQueueHealth();
    res.json({
      success: true,
      ...health,
      warning: health.transportIsLive
        ? undefined
        : "No eRx gateway is configured. Cancellations are being queued and are NOT reaching pharmacies.",
    });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to read queue health");
    res.status(500).json({ success: false, error: "Failed to read queue health" });
  }
});

router.post("/admin/process-queue", requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Number.parseInt((req.body?.limit as string) ?? "", 10);
    const result = await processPendingTransmissions(Number.isFinite(limit) ? limit : undefined);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ component: "ErxCancelRoutes", err: error }, "Failed to process transmission queue");
    res.status(500).json({ success: false, error: "Failed to process transmission queue" });
  }
});

export default router;
