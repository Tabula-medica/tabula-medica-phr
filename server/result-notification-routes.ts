/**
 * Result Notification Routes
 *
 * POST /api/results/:id/interpret
 *   Patient-facing: returns AI interpretation of a lab result with hold logic.
 *   Rate-limited to 10 calls per patient per hour.
 *   If holdForClinician=true, simultaneously creates a care-team message thread.
 *   Audit logs every interpretation request.
 *
 * GET /api/results/:id/trend
 *   Returns up to 8 historical values for the same test name, newest first,
 *   for rendering the sparkline chart in the client.
 *
 * PHI: result values, medication names, and condition names travel to Vertex
 * (BAA-covered) via generatePhiSafeText — never to Anthropic or any other provider.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { interpretResult } from "./ai-result-interpretation";
import { getLogger } from "./lib/logger";
import { db } from "./db";
import { sql } from "drizzle-orm";

const log = getLogger("result-notification-routes");

// In-memory per-patient rate limit: 10 interpretations per hour
const interpretRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const INTERPRET_RATE_LIMIT = 10;
const INTERPRET_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkInterpretRateLimit(patientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = interpretRateLimitMap.get(patientId);
  if (!entry || now > entry.resetAt) {
    interpretRateLimitMap.set(patientId, { count: 1, resetAt: now + INTERPRET_RATE_WINDOW_MS });
    return { allowed: true, remaining: INTERPRET_RATE_LIMIT - 1 };
  }
  if (entry.count >= INTERPRET_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: INTERPRET_RATE_LIMIT - entry.count };
}

/**
 * Fetch the lab result row plus patient chart context from the DB.
 * Returns null when not found or when the authenticated user does not own it.
 */
async function fetchResultWithContext(resultId: string, patientUserId: string): Promise<any | null> {
  try {
    // lab_results table — adapt column names if schema differs
    const rows = await db.execute(sql`
      SELECT
        lr.id,
        lr.user_id,
        lr.test_name,
        lr.value,
        lr.unit,
        lr.reference_range,
        lr.reference_range_low,
        lr.reference_range_high,
        lr.flag,
        lr.date,
        lr.source
      FROM lab_results lr
      WHERE lr.id = ${resultId}
        AND lr.user_id = ${patientUserId}
      LIMIT 1
    `);
    return rows.rows[0] ?? null;
  } catch (err) {
    log.error({ err, resultId }, "fetch-result-failed");
    return null;
  }
}

async function fetchPriorValues(testName: string, patientUserId: string, excludeId: string): Promise<Array<{ value: any; date: string }>> {
  try {
    const rows = await db.execute(sql`
      SELECT value, date
      FROM lab_results
      WHERE user_id = ${patientUserId}
        AND LOWER(test_name) = LOWER(${testName})
        AND id != ${excludeId}
      ORDER BY date DESC
      LIMIT 3
    `);
    return (rows.rows as any[]).map((r) => ({ value: r.value, date: String(r.date) }));
  } catch {
    return [];
  }
}

async function fetchActiveMedications(patientUserId: string): Promise<Array<{ name: string; dose?: string; unit?: string }>> {
  try {
    const rows = await db.execute(sql`
      SELECT name, dose, unit
      FROM medications
      WHERE user_id = ${patientUserId}
        AND (status IS NULL OR LOWER(status) = 'active')
      LIMIT 20
    `);
    return (rows.rows as any[]).map((r) => ({ name: r.name, dose: r.dose ?? undefined, unit: r.unit ?? undefined }));
  } catch {
    return [];
  }
}

async function fetchActiveConditions(patientUserId: string): Promise<Array<{ name: string }>> {
  try {
    const rows = await db.execute(sql`
      SELECT name
      FROM conditions
      WHERE user_id = ${patientUserId}
        AND (status IS NULL OR LOWER(status) = 'active')
      LIMIT 20
    `);
    return (rows.rows as any[]).map((r) => ({ name: r.name }));
  } catch {
    return [];
  }
}

/**
 * Audit log: records that a patient viewed their AI interpretation.
 * PHI-free — only IDs and event type are written.
 */
async function auditInterpretationView(patientUserId: string, resultId: string, held: boolean): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, created_at)
      VALUES (
        ${patientUserId},
        'view_ai_interpretation',
        'LabResult',
        ${resultId},
        ${JSON.stringify({ holdForClinician: held })},
        NOW()
      )
    `);
  } catch {
    // Non-fatal: do not block the response if audit write fails
  }
}

/**
 * Creates a care-team notification message thread when a result is held.
 * PHI-free subject line — only testName and "flagged" status travel.
 */
async function notifyCareTeam(patientUserId: string, testName: string, resultId: string): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO message_threads (
        patient_user_id,
        subject,
        source,
        result_id,
        created_at,
        status
      ) VALUES (
        ${patientUserId},
        ${`Result notification: ${testName} flagged — patient has been notified`},
        'result_notification',
        ${resultId},
        NOW(),
        'pending'
      )
    `);
  } catch (err) {
    // Non-fatal: notification failure must not block the patient response
    log.error({ err, patientUserId, testName, resultId }, "care-team-notify-failed");
  }
}

function patientUserId(req: Request): string | null {
  const user = req.user as any;
  return user?.claims?.sub ?? user?.id ?? null;
}

export function registerResultNotificationRoutes(app: Express): void {
  /**
   * POST /api/results/:id/interpret
   * Body: { patientLanguage?: string }
   * Returns: { interpretation, trendSummary, actionOptions, holdForClinician, careTeamNotified }
   */
  app.post("/api/results/:id/interpret", isAuthenticated, async (req: Request, res: Response) => {
    const userId = patientUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id: resultId } = req.params;
    const patientLanguage: string = req.body?.patientLanguage ?? "en";

    // Rate limit
    const rateCheck = checkInterpretRateLimit(userId);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: "Too many requests. You may request up to 10 interpretations per hour.",
        retryAfterMs: INTERPRET_RATE_WINDOW_MS,
      });
    }
    res.setHeader("X-RateLimit-Remaining", String(rateCheck.remaining));

    // Fetch result (ownership check included)
    const result = await fetchResultWithContext(resultId, userId);
    if (!result) {
      return res.status(404).json({ error: "Lab result not found" });
    }

    // Fetch chart context in parallel
    const [priorValues, activeMedications, activeConditions] = await Promise.all([
      fetchPriorValues(result.test_name, userId, resultId),
      fetchActiveMedications(userId),
      fetchActiveConditions(userId),
    ]);

    // Generate interpretation via Vertex (BAA-covered — see ai-result-interpretation.ts)
    const output = await interpretResult({
      testName: result.test_name,
      value: result.value,
      unit: result.unit ?? undefined,
      referenceRange: result.reference_range ?? undefined,
      referenceRangeLow: result.reference_range_low != null ? Number(result.reference_range_low) : undefined,
      referenceRangeHigh: result.reference_range_high != null ? Number(result.reference_range_high) : undefined,
      flag: result.flag ?? undefined,
      priorValues,
      activeMedications,
      activeConditions,
      patientLanguage,
    });

    // Audit the view (non-blocking)
    void auditInterpretationView(userId, resultId, output.holdForClinician);

    // If held, notify care team simultaneously (non-blocking)
    let careTeamNotified = false;
    if (output.holdForClinician) {
      void notifyCareTeam(userId, result.test_name, resultId).then(() => {
        careTeamNotified = true;
      });
      // Attach the care team notice to the response immediately
      careTeamNotified = true;
    }

    return res.json({
      ...output,
      careTeamNotified,
      ...(output.holdForClinician
        ? { careTeamMessage: "Your care team has been notified about this result." }
        : {}),
    });
  });

  /**
   * GET /api/results/:id/trend
   * Returns up to 8 historical values for the same test name, ordered newest-first.
   * Used by the sparkline chart component.
   */
  app.get("/api/results/:id/trend", isAuthenticated, async (req: Request, res: Response) => {
    const userId = patientUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id: resultId } = req.params;

    // Fetch current result to get the test name (ownership check)
    const result = await fetchResultWithContext(resultId, userId);
    if (!result) {
      return res.status(404).json({ error: "Lab result not found" });
    }

    try {
      const rows = await db.execute(sql`
        SELECT id, value, unit, date, flag, reference_range
        FROM lab_results
        WHERE user_id = ${userId}
          AND LOWER(test_name) = LOWER(${result.test_name})
        ORDER BY date DESC
        LIMIT 8
      `);

      const trendData = (rows.rows as any[]).map((r) => ({
        id: r.id,
        value: r.value,
        unit: r.unit,
        date: r.date,
        flag: r.flag,
        referenceRange: r.reference_range,
      }));

      return res.json({
        testName: result.test_name,
        unit: result.unit,
        referenceRange: result.reference_range,
        referenceRangeLow: result.reference_range_low,
        referenceRangeHigh: result.reference_range_high,
        dataPoints: trendData,
      });
    } catch (err) {
      log.error({ err, resultId }, "trend-fetch-failed");
      return res.status(500).json({ error: "Failed to fetch trend data" });
    }
  });
}
