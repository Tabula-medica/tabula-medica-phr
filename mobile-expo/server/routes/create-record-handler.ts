/**
 * Factory for the POST /api/records handler.
 *
 * Extracted into its own module so the regression suite
 * (`server/__tests__/create-record.test.ts`, Task #94) can mount it with
 * stubbed dependencies and assert the gamification / automation contract
 * without booting the whole route surface.
 *
 * Behaviour (preserved verbatim from the inline handler that previously
 * lived in `server/routes/collab-2.ts`, see Task #13):
 *
 *   - Phase 1: storage.createHealthRecord(...) must succeed. If it throws,
 *     respond 500 and log the full stack — the response intentionally hides
 *     the error message so prod stack traces stay out of client responses.
 *   - Phase 2: best-effort side-effects (awardPoints, incrementRecordsLogged,
 *     auditLog, clinicalAutomationEngine.processTrigger). Each is caught
 *     independently so a single failure cannot turn a successful write into
 *     a 500. The 201 response carries the saved record.
 */
import type { Request, RequestHandler, Response } from "express";

export type RecordsHandlerStorage = {
  createHealthRecord: (data: any) => Promise<any>;
  getHealthRecords: (userId: string) => Promise<any[]>;
  awardPoints: (
    userId: string,
    points: number,
    reason: string,
    category: string,
    relatedEntityType?: string,
    relatedEntityId?: string,
    metadata?: any,
  ) => Promise<any>;
  incrementRecordsLogged: (userId: string) => Promise<void>;
};

export type RecordsHandlerAutomation = {
  processTrigger: (event: any, records: any[]) => Promise<any>;
};

export type AuditLogFn = (
  req: Request,
  action: string,
  resourceType?: string,
  resourceId?: string,
  metadata?: object,
) => void;

export type GetUserIdFn = (req: Request) => string;

export interface CreateRecordHandlerDeps {
  storage: RecordsHandlerStorage;
  clinicalAutomationEngine: RecordsHandlerAutomation;
  auditLog: AuditLogFn;
  getUserId: GetUserIdFn;
}

export function createCreateRecordHandler(
  deps: CreateRecordHandlerDeps,
): RequestHandler {
  const { storage, clinicalAutomationEngine, auditLog, getUserId } = deps;

  return async function createRecordHandler(req: Request, res: Response) {
    const userId = getUserId(req);
    let record: Awaited<ReturnType<typeof storage.createHealthRecord>>;
    try {
      const recordData = { ...req.body };
      if (typeof recordData.date === "string") {
        recordData.date = new Date(recordData.date);
      }
      record = await storage.createHealthRecord({
        ...recordData,
        userId,
        isManual: true,
      });
    } catch (error: any) {
      console.error(
        "[Records] storage.createHealthRecord failed:",
        error?.stack || error?.message || error,
      );
      return res.status(500).json({ error: "Failed to create record" });
    }

    try {
      const userRecords = await storage.getHealthRecords(userId);
      try {
        if (userRecords.length === 1) {
          await storage.awardPoints(
            userId,
            25,
            "first_record_logged",
            "milestones",
            "record",
            record.id,
          );
        } else {
          await storage.awardPoints(
            userId,
            15,
            "record_logged",
            "logging",
            "record",
            record.id,
          );
        }
      } catch (err: any) {
        console.warn(
          "[Records] awardPoints failed (non-blocking):",
          err?.stack || err?.message || err,
        );
      }
      try {
        await storage.incrementRecordsLogged(userId);
      } catch (err: any) {
        console.warn(
          "[Records] incrementRecordsLogged failed (non-blocking):",
          err?.stack || err?.message || err,
        );
      }
      try {
        auditLog(req, "create_record", "health_record", record.id);
      } catch (err: any) {
        console.warn(
          "[Records] auditLog failed (non-blocking):",
          err?.stack || err?.message || err,
        );
      }

      const triggerTypeMap: Record<string, string> = {
        condition: "diagnosis_added",
        medication: "medication_changed",
        vital: "vitals_recorded",
        lab: "lab_result_added",
        labs: "lab_result_added",
        visit: "visit_completed",
      };
      const triggerType = triggerTypeMap[req.body.type];
      if (triggerType) {
        clinicalAutomationEngine
          .processTrigger(
            {
              id: `auto_${Date.now()}`,
              type: triggerType as any,
              patientId: userId,
              recordId: record.id,
              data: {
                title: record.title,
                summary: record.summary,
                type: record.type,
                ...req.body,
              },
              timestamp: new Date(),
            },
            userRecords,
          )
          .catch((err) =>
            console.error(
              "[AutomationEngine] Background trigger error:",
              err,
            ),
          );
      }
    } catch (err: any) {
      console.warn(
        "[Records] post-create side-effects failed (non-blocking):",
        err?.stack || err?.message || err,
      );
    }

    return res.status(201).json(record);
  };
}
