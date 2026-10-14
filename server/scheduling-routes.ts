/**
 * Scheduling Routes — AI triage intake + scheduling request submission.
 *
 * POST /api/schedule/triage   — Vertex AI triage on free-text symptoms (non-PHI response).
 * POST /api/schedule/request  — Persist encrypted scheduling request, notify care team.
 * GET  /api/schedule/requests — Patient's own past requests (non-sensitive fields only).
 *
 * PHI rules:
 *   - symptomText encrypted via encryptPhiRow before DB write.
 *   - Chart context (problems/meds) fetched server-side; never accepted from request body.
 *   - Triage result (urgency/visitType/reasoning/warningSymptoms) is non-PHI; returned to client.
 *   - All routes require authentication via requireUser.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";
import { phiDb, encryptPhiRow } from "./storage/phi-storage";
import { requireUser, getUserId } from "./middleware/require-user";
import { triageSchedulingRequest } from "./ai-scheduling-triage";
import {
  profiles,
  medicationsTable,
  medicalHistoryTable,
  schedulingRequestsTable,
} from "@shared/schema";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const triageBodySchema = z.object({
  symptomText: z.string().min(3).max(3000),
  patientLanguage: z.string().max(10).default("en"),
});

const requestBodySchema = z.object({
  symptomText: z.string().min(3).max(3000),
  patientLanguage: z.string().max(10).default("en"),
  triageResult: z.object({
    urgency: z.enum(["call-911", "same-day", "within-3-days", "within-2-weeks"]),
    visitType: z.enum(["in-person", "telehealth", "urgent-care"]),
    reasoning: z.string(),
    warningSymptoms: z.array(z.string()),
  }),
});

// ---------------------------------------------------------------------------
// Chart context helpers — server-side only, no demographics
// ---------------------------------------------------------------------------

async function getActiveProblems(userId: string): Promise<string[]> {
  try {
    const rows = await phiDb
      .select({ name: medicalHistoryTable.condition })
      .from(medicalHistoryTable)
      .innerJoin(profiles, eq(medicalHistoryTable.profileId, profiles.id))
      .where(
        and(
          eq(profiles.accountId, userId),
          eq(medicalHistoryTable.status, "active")
        )
      )
      .limit(30);
    return rows.map((r) => r.name).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

async function getActiveMedications(userId: string): Promise<string[]> {
  try {
    const rows = await phiDb
      .select({ name: medicationsTable.name })
      .from(medicationsTable)
      .innerJoin(profiles, eq(medicationsTable.profileId, profiles.id))
      .where(
        and(
          eq(profiles.accountId, userId),
          eq(medicationsTable.status, "active")
        )
      )
      .limit(30);
    return rows.map((r) => r.name).filter(Boolean) as string[];
  } catch {
    return [];
  }
}

function expectedResponseTime(urgency: string): string {
  switch (urgency) {
    case "call-911":       return "Call 911 now";
    case "same-day":       return "within a few hours";
    case "within-3-days":  return "within 1-3 business days";
    case "within-2-weeks": return "within 2 weeks";
    default:               return "within 3 business days";
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerSchedulingRoutes(app: Express) {
  /**
   * POST /api/schedule/triage
   * Runs Vertex AI triage server-side. Chart context resolved from session.
   */
  app.post("/api/schedule/triage", requireUser, async (req: Request, res: Response) => {
    try {
      const body = triageBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: body.error.issues.map((i) => i.message).join(", "),
        });
      }

      const userId = getUserId(req);
      const { symptomText, patientLanguage } = body.data;

      const [problems, medications] = await Promise.all([
        getActiveProblems(userId),
        getActiveMedications(userId),
      ]);

      const result = await triageSchedulingRequest(
        symptomText,
        patientLanguage,
        problems,
        medications
      );

      return res.json({
        triage: result,
        expectedResponseTime: expectedResponseTime(result.urgency),
      });
    } catch (err: any) {
      console.error("[scheduling-routes] /triage error:", err?.message ?? err);
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "Triage failed." });
    }
  });

  /**
   * POST /api/schedule/request
   * Persists encrypted scheduling request; notifies practice via care-team messages.
   */
  app.post("/api/schedule/request", requireUser, async (req: Request, res: Response) => {
    try {
      const body = requestBodySchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: body.error.issues.map((i) => i.message).join(", "),
        });
      }

      const userId = getUserId(req);
      const { symptomText, patientLanguage, triageResult } = body.data;

      // Resolve patientId from profiles (IDOR guard: use the first owned profile)
      let patientProfileId: string | null = null;
      try {
        const [profile] = await phiDb
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.accountId, userId))
          .limit(1);
        patientProfileId = profile?.id ?? null;
      } catch { /* profile lookup failure — handled below */ }

      if (!patientProfileId) {
        return res.status(422).json({
          error: "NO_PROFILE",
          message: "No patient profile found. Please complete onboarding first.",
        });
      }

      // Encrypt symptom text at application layer before writing.
      const encryptedRow = encryptPhiRow("scheduling_requests", {
        patientId: patientProfileId,
        urgency: triageResult.urgency,
        visitType: triageResult.visitType,
        symptomText,
        triageResult: triageResult as unknown as Record<string, unknown>,
        language: patientLanguage,
        status: "pending" as const,
      });

      const [inserted] = await phiDb
        .insert(schedulingRequestsTable)
        .values(encryptedRow)
        .returning({
          id: schedulingRequestsTable.id,
          urgency: schedulingRequestsTable.urgency,
          visitType: schedulingRequestsTable.visitType,
          requestedAt: schedulingRequestsTable.requestedAt,
        });

      const requestId = inserted?.id ?? "unknown";

      // Notify practice: try to insert a care-team message thread (best-effort).
      try {
        const { pool } = await import("./db");
        await pool.query(
          `INSERT INTO messages (sender_id, subject, body, message_type, created_at)
           VALUES ($1, $2, $3, 'scheduling_request', NOW())
           ON CONFLICT DO NOTHING`,
          [
            userId,
            `Scheduling request: ${triageResult.urgency}`,
            `Patient scheduling request received. Urgency: ${triageResult.urgency}. Visit type: ${triageResult.visitType}. Reference: ${requestId}`,
          ]
        );
      } catch {
        // Messages table may not exist in all environments — do not fail the request.
      }

      return res.status(201).json({
        requestId,
        urgency: triageResult.urgency,
        visitType: triageResult.visitType,
        expectedResponseTime: expectedResponseTime(triageResult.urgency),
        status: "pending",
      });
    } catch (err: any) {
      console.error("[scheduling-routes] /request error:", err?.message ?? err);
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Could not submit scheduling request.",
      });
    }
  });

  /**
   * GET /api/schedule/requests
   * Returns the patient's own scheduling requests. Excludes symptom_text from response.
   */
  app.get("/api/schedule/requests", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      const patientProfileIds = await phiDb
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.accountId, userId))
        .limit(5);

      if (!patientProfileIds.length) {
        return res.json({ requests: [] });
      }

      const ids = patientProfileIds.map((p) => p.id);

      const requests = await phiDb
        .select({
          id: schedulingRequestsTable.id,
          urgency: schedulingRequestsTable.urgency,
          visitType: schedulingRequestsTable.visitType,
          language: schedulingRequestsTable.language,
          requestedAt: schedulingRequestsTable.requestedAt,
          status: schedulingRequestsTable.status,
          confirmedAt: schedulingRequestsTable.confirmedAt,
        })
        .from(schedulingRequestsTable)
        .where(eq(schedulingRequestsTable.patientId, ids[0]))
        .orderBy(desc(schedulingRequestsTable.requestedAt))
        .limit(20);

      return res.json({ requests });
    } catch (err: any) {
      console.error("[scheduling-routes] /requests GET error:", err?.message ?? err);
      return res.status(500).json({ error: "INTERNAL_ERROR", message: "Could not fetch requests." });
    }
  });
}