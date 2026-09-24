/**
 * Outpatient order entry — one place to place and track every order type
 * against a patient's chart: labs, imaging, referrals, medications, DME.
 *
 * Mounted at /api/outpatient-orders/:profileId[...]. `:profileId` is the
 * PHR's own patient identity (`profiles.id`, the id behind every phr_*
 * table) — not the aggregated multi-EHR-source "patient" concept used by
 * `/api/patients/:id` elsewhere in this codebase (that id belongs to
 * `storage.getPatient`, a different identity space for records pulled in
 * from a patient's OTHER connected EHRs). Ordering happens against this
 * clinic's own record of the patient, so it has to be the same id every
 * other clinician-facing PHR route already uses.
 *
 * ## What "transmitted" means
 *
 * Marking an order transmitted timestamps the hand-off and logs it to
 * `outpatientOrderEventsTable` — it does not submit anything to a real lab
 * interface, e-prescribing network (Surescripts or otherwise), payer EDI
 * clearinghouse, or DME supplier system. There is no vendor credential for
 * any of those anywhere in this codebase. Until a real integration exists
 * and is named here, "transmitted" means a person still has to actually get
 * the order to its recipient (fax, portal upload, phone) — the same
 * distinction `docs/rcm-capability-and-why.md` draws for claim submission.
 * The point of tracking it is the audit trail and the "at a glance" status,
 * not automated delivery.
 *
 * ## Authorization — read before extending this file
 *
 * Gated with `requirePermission`, the same guard `/api/patients/:id` and
 * its sibling sub-resource routes use elsewhere in server/routes.ts. That
 * proves the caller holds a role with the permission — it does NOT prove
 * the caller has any treatment relationship with this specific patient.
 * Nothing in this codebase's RBAC model (`shared/schema.ts` rolePermissions)
 * scopes access by clinic or care-team membership; any account with
 * `records:write` can order for any profile. That is a real, pre-existing
 * gap shared with every other `/api/patients/:id/*` route in this app, not
 * one introduced here — but it means this module is not yet safe for a
 * multi-clinic deployment where clinicians must not see each other's
 * patients, and that should be fixed before one exists.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  profiles,
  outpatientOrdersTable,
  outpatientOrderEventsTable,
  outpatientOrderTypes,
  outpatientOrderStatuses,
  outpatientOrderPriorities,
  outpatientOrderTransmissionMethods,
  insertOutpatientOrderSchema,
  hasPermission,
  type OutpatientOrderStatus,
} from "@shared/schema";
import { phiDb, encryptPhiRow, decryptPhiRow, decryptPhiRows } from "./storage/phi-storage";
import { requirePermission, auditDataAccess } from "./rbac";
import { logPhiAccess } from "./security/hipaa-audit";
import { noStorePhi } from "./lib/middleware/no-store-phi";

function callerUserId(req: Request): string {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    "unknown"
  );
}

function callerName(req: Request): string | null {
  const user = req.user as any;
  return user?.claims?.name || user?.name || null;
}

async function patientExists(profileId: string): Promise<boolean> {
  const rows = await phiDb.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  return rows.length > 0;
}

async function recordEvent(
  orderId: string,
  eventType: "created" | "signed" | "transmitted" | "acknowledged" | "status_changed" | "cancelled" | "note_added",
  eventDetail: string | null,
  req: Request,
): Promise<void> {
  await phiDb.insert(outpatientOrderEventsTable).values(
    encryptPhiRow("outpatientOrderEventsTable", {
      orderId,
      eventType,
      eventDetail,
      actorUserId: callerUserId(req),
      actorName: callerName(req),
    }),
  );
}

const transmitSchema = z.object({
  action: z.literal("transmit"),
  transmissionMethod: z.enum(outpatientOrderTransmissionMethods).refine((m) => m !== "pending", {
    message: "transmissionMethod must name how the order was actually handed off",
  }),
  recipientName: z.string().max(300).optional().nullable(),
});

const signSchema = z.object({ action: z.literal("sign") });

const cancelSchema = z.object({
  action: z.literal("cancel"),
  cancelReason: z.string().min(1).max(1000),
});

const statusSchema = z.object({
  action: z.literal("set_status"),
  status: z.enum(outpatientOrderStatuses),
  note: z.string().max(1000).optional().nullable(),
});

const orderActionSchema = z.discriminatedUnion("action", [transmitSchema, signSchema, cancelSchema, statusSchema]);

export function registerOutpatientOrderRoutes(app: Express): void {
  app.use("/api/outpatient-orders", noStorePhi);

  // Worklist — every order for this patient, newest first. This is the
  // "one place at a glance" view: the client groups/badges by status.
  app.get(
    "/api/outpatient-orders/:profileId",
    requirePermission("records:read"),
    auditDataAccess("outpatient_orders", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) {
          return res.status(404).json({ error: "Patient not found" });
        }

        const typeFilter = typeof req.query.orderType === "string" ? req.query.orderType : undefined;

        let rows = await phiDb
          .select()
          .from(outpatientOrdersTable)
          .where(eq(outpatientOrdersTable.profileId, profileId))
          .orderBy(desc(outpatientOrdersTable.createdAt));

        if (typeFilter) {
          rows = rows.filter((r) => r.orderType === typeFilter);
        }

        await logPhiAccess({
          userId: callerUserId(req),
          patientId: profileId,
          resourceType: "outpatient_orders",
          action: "read",
          requestPath: req.path,
          requestMethod: req.method,
        });

        res.json({ orders: decryptPhiRows("outpatientOrdersTable", rows) });
      } catch (error) {
        console.error("[outpatient-orders] list error:", error);
        res.status(500).json({ error: "Failed to load orders" });
      }
    },
  );

  // Create a new order. Medication orders additionally require
  // medications:write — records:write alone covers labs, imaging,
  // referrals, and DME, which this RBAC model treats as record entries
  // rather than prescribing.
  app.post(
    "/api/outpatient-orders/:profileId",
    requirePermission("records:write"),
    auditDataAccess("outpatient_orders", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) {
          return res.status(404).json({ error: "Patient not found" });
        }

        const parsed = insertOutpatientOrderSchema.omit({ profileId: true, orderedByUserId: true }).safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid order", details: parsed.error.flatten() });
        }

        if (parsed.data.orderType === "medication") {
          const role = (req as any).userRole;
          if (!role || !hasPermission(role, "medications:write")) {
            return res.status(403).json({
              error: "Forbidden",
              message: "Medication orders require the medications:write permission",
            });
          }
        }

        const [row] = await phiDb
          .insert(outpatientOrdersTable)
          .values(
            encryptPhiRow("outpatientOrdersTable", {
              ...parsed.data,
              profileId,
              orderedByUserId: callerUserId(req),
              orderedByName: callerName(req),
            }),
          )
          .returning();

        await recordEvent(row.id, "created", `${parsed.data.orderType} order created: ${parsed.data.description}`, req);

        await logPhiAccess({
          userId: callerUserId(req),
          patientId: profileId,
          resourceType: "outpatient_orders",
          action: "write",
          resourceId: row.id,
          requestPath: req.path,
          requestMethod: req.method,
        });

        res.status(201).json({ order: decryptPhiRow("outpatientOrdersTable", row) });
      } catch (error) {
        console.error("[outpatient-orders] create error:", error);
        res.status(500).json({ error: "Failed to create order" });
      }
    },
  );

  // Sign, transmit, cancel, or otherwise move an order's status. One
  // endpoint with a discriminated `action` body rather than four thin
  // endpoints, because every action shares the same "load, check, mutate,
  // log an event" shape and a single audit event stream per order is the
  // whole point of the "at a glance" timeline.
  app.patch(
    "/api/outpatient-orders/:profileId/:orderId",
    requirePermission("records:write"),
    auditDataAccess("outpatient_orders", "update"),
    async (req: Request, res: Response) => {
      try {
        const { profileId, orderId } = req.params;

        const [existingRaw] = await phiDb
          .select()
          .from(outpatientOrdersTable)
          .where(and(eq(outpatientOrdersTable.id, orderId), eq(outpatientOrdersTable.profileId, profileId)))
          .limit(1);
        if (!existingRaw) {
          return res.status(404).json({ error: "Order not found" });
        }
        const existing = decryptPhiRow("outpatientOrdersTable", existingRaw);

        const parsed = orderActionSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid action", details: parsed.error.flatten() });
        }

        if (existing.status === "cancelled" || existing.status === "completed") {
          return res.status(409).json({ error: `Order is ${existing.status} and cannot be modified` });
        }

        let nextStatus: OutpatientOrderStatus = existing.status;
        const patch: Record<string, unknown> = { updatedAt: new Date() };
        let eventType: Parameters<typeof recordEvent>[1];
        let eventDetail: string | null = null;

        switch (parsed.data.action) {
          case "sign":
            if (existing.status !== "draft") {
              return res.status(409).json({ error: "Only a draft order can be signed" });
            }
            nextStatus = "signed";
            patch.signedAt = new Date();
            eventType = "signed";
            break;
          case "transmit":
            if (existing.status !== "signed" && existing.status !== "draft") {
              return res.status(409).json({ error: "Order must be signed before it can be transmitted" });
            }
            nextStatus = "transmitted";
            patch.transmittedAt = new Date();
            patch.transmissionMethod = parsed.data.transmissionMethod;
            if (parsed.data.recipientName) {
              patch.recipientName = parsed.data.recipientName;
            }
            eventType = "transmitted";
            eventDetail = `via ${parsed.data.transmissionMethod}${parsed.data.recipientName ? ` to ${parsed.data.recipientName}` : ""}`;
            break;
          case "cancel":
            nextStatus = "cancelled";
            patch.cancelledAt = new Date();
            patch.cancelReason = parsed.data.cancelReason;
            eventType = "cancelled";
            eventDetail = parsed.data.cancelReason;
            break;
          case "set_status":
            nextStatus = parsed.data.status;
            eventType = "status_changed";
            eventDetail = parsed.data.note || `${existing.status} → ${parsed.data.status}`;
            break;
        }

        patch.status = nextStatus;

        const [updated] = await phiDb
          .update(outpatientOrdersTable)
          .set(encryptPhiRow("outpatientOrdersTable", patch))
          .where(eq(outpatientOrdersTable.id, orderId))
          .returning();

        await recordEvent(orderId, eventType, eventDetail, req);

        await logPhiAccess({
          userId: callerUserId(req),
          patientId: profileId,
          resourceType: "outpatient_orders",
          action: "write",
          resourceId: orderId,
          requestPath: req.path,
          requestMethod: req.method,
        });

        res.json({ order: decryptPhiRow("outpatientOrdersTable", updated) });
      } catch (error) {
        console.error("[outpatient-orders] update error:", error);
        res.status(500).json({ error: "Failed to update order" });
      }
    },
  );

  // The activity/transmission timeline for one order.
  app.get(
    "/api/outpatient-orders/:profileId/:orderId/events",
    requirePermission("records:read"),
    auditDataAccess("outpatient_orders", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId, orderId } = req.params;

        const [owner] = await phiDb
          .select({ id: outpatientOrdersTable.id })
          .from(outpatientOrdersTable)
          .where(and(eq(outpatientOrdersTable.id, orderId), eq(outpatientOrdersTable.profileId, profileId)))
          .limit(1);
        if (!owner) {
          return res.status(404).json({ error: "Order not found" });
        }

        const rows = await phiDb
          .select()
          .from(outpatientOrderEventsTable)
          .where(eq(outpatientOrderEventsTable.orderId, orderId))
          .orderBy(desc(outpatientOrderEventsTable.createdAt));

        res.json({ events: decryptPhiRows("outpatientOrderEventsTable", rows) });
      } catch (error) {
        console.error("[outpatient-orders] events error:", error);
        res.status(500).json({ error: "Failed to load order history" });
      }
    },
  );
}

export { outpatientOrderTypes, outpatientOrderStatuses, outpatientOrderPriorities };
