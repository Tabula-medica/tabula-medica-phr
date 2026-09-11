import type { Express, Request, Response } from "express";
import { z } from "zod";
import { iisDataReconciliationService, ReconciliationStatus, MatchConfidenceLevel, ResolutionType } from "./services/iis-data-reconciliation-service";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser, getUserId } from "./middleware/require-user";

const RunReconciliationSchema = z.object({
  patientId: z.string().min(1),
  config: z.object({
    autoVerifyThreshold: z.number().min(0).max(1).optional(),
    reviewThreshold: z.number().min(0).max(1).optional(),
    dateToleranceDays: z.number().min(0).max(30).optional(),
    enableFuzzyMatching: z.boolean().optional()
  }).optional()
});

const ReviewQueueFiltersSchema = z.object({
  status: z.array(z.enum(["pending", "auto_verified", "needs_review", "resolved", "rejected"])).optional(),
  patientId: z.string().optional(),
  confidenceLevel: z.array(z.enum(["high", "medium", "low", "no_match"])).optional(),
  hasDiscrepancies: z.boolean().optional()
});

const ResolveMatchSchema = z.object({
  resolutionType: z.enum(["accept_local", "accept_iis", "merge", "manual_entry", "reject"]),
  notes: z.string().optional(),
  finalValues: z.record(z.string()).optional()
});

const BulkAutoVerifySchema = z.object({
  confidenceThreshold: z.number().min(0.9).max(1).default(0.98)
});

const UpdateConfigSchema = z.object({
  autoVerifyThreshold: z.number().min(0).max(1).optional(),
  reviewThreshold: z.number().min(0).max(1).optional(),
  dateToleranceDays: z.number().min(0).max(30).optional(),
  enableFuzzyMatching: z.boolean().optional()
});

export function registerIISDataReconciliationRoutes(app: Express): void {
  app.post("/api/iis-reconciliation/run", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const userRole = req.headers["x-user-role"] as string || "clinician";
      const parsed = RunReconciliationSchema.parse(req.body);

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "IISReconciliation",
        patientId: parsed.patientId,
        details: `Initiated IIS reconciliation for patient ${parsed.patientId}`
      });

      const matches = await iisDataReconciliationService.runReconciliation(
        parsed.patientId,
        userId,
        userRole,
        parsed.config as any
      );

      res.json({
        success: true,
        data: {
          matches,
          summary: {
            total: matches.length,
            autoVerified: matches.filter(m => m.autoVerified).length,
            needsReview: matches.filter(m => m.status === "needs_review").length,
            pending: matches.filter(m => m.status === "pending").length
          }
        },
        disclaimer: "IIS data reconciliation is for verification purposes only. All immunization records should be reviewed by a qualified healthcare provider. This system does not provide clinical decision support."
      });
    } catch (error) {
      console.error("[IISReconciliation] Error running reconciliation:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to run reconciliation",
        disclaimer: "This system does not provide clinical decision support."
      });
    }
  });

  app.get("/api/iis-reconciliation/review-queue", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const userRole = req.headers["x-user-role"] as string || "clinician";

      let filters: z.infer<typeof ReviewQueueFiltersSchema> = {};
      if (req.query.status) {
        filters.status = (req.query.status as string).split(",") as ReconciliationStatus[];
      }
      if (req.query.patientId) {
        filters.patientId = req.query.patientId as string;
      }
      if (req.query.confidenceLevel) {
        filters.confidenceLevel = (req.query.confidenceLevel as string).split(",") as MatchConfidenceLevel[];
      }
      if (req.query.hasDiscrepancies !== undefined) {
        filters.hasDiscrepancies = req.query.hasDiscrepancies === "true";
      }

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "ReconciliationReviewQueue",
        details: `Accessed review queue with filters: ${JSON.stringify(filters)}`
      });

      const matches = await iisDataReconciliationService.getReviewQueue(userId, userRole, filters);

      res.json({
        success: true,
        data: matches,
        total: matches.length,
        disclaimer: "All reconciliation decisions should be reviewed by qualified healthcare personnel. This system does not provide clinical decision support."
      });
    } catch (error) {
      console.error("[IISReconciliation] Error fetching review queue:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch review queue" 
      });
    }
  });

  app.get("/api/iis-reconciliation/match/:matchId", requireUser, async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const userId = getUserId(req);

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "ReconciliationMatch",
        resourceId: matchId,
        details: `Viewed match details for ${matchId}`
      });

      const details = await iisDataReconciliationService.getMatchDetails(matchId, userId);

      if (!details) {
        return res.status(404).json({ 
          success: false, 
          error: "Match not found" 
        });
      }

      res.json({
        success: true,
        data: details,
        disclaimer: "Review all discrepancies carefully before making a resolution decision. This system does not provide clinical decision support."
      });
    } catch (error) {
      console.error("[IISReconciliation] Error fetching match details:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch match details" 
      });
    }
  });

  app.post("/api/iis-reconciliation/match/:matchId/resolve", requireUser, async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const userId = getUserId(req);
      const userRole = req.headers["x-user-role"] as string || "clinician";
      const parsed = ResolveMatchSchema.parse(req.body);

      await logPhiAccess({
        userId,
        action: "write",
        resourceType: "ReconciliationMatch",
        resourceId: matchId,
        details: `Resolved match ${matchId} with ${parsed.resolutionType}`
      });

      const match = await iisDataReconciliationService.resolveMatch(
        matchId,
        parsed.resolutionType as ResolutionType,
        userId,
        userRole,
        parsed.notes,
        parsed.finalValues
      );

      if (!match) {
        return res.status(404).json({ 
          success: false, 
          error: "Match not found" 
        });
      }

      res.json({
        success: true,
        data: match,
        message: `Match resolved as ${parsed.resolutionType}`,
        disclaimer: "Resolution has been recorded. All immunization records should be verified by qualified healthcare personnel."
      });
    } catch (error) {
      console.error("[IISReconciliation] Error resolving match:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to resolve match" 
      });
    }
  });

  app.get("/api/iis-reconciliation/stats", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "ReconciliationStats",
        details: "Viewed reconciliation statistics"
      });

      const stats = await iisDataReconciliationService.getReconciliationStats(userId);

      res.json({
        success: true,
        data: stats,
        disclaimer: "Statistics are for operational purposes only. This system does not provide clinical decision support."
      });
    } catch (error) {
      console.error("[IISReconciliation] Error fetching stats:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch statistics" 
      });
    }
  });

  app.get("/api/iis-reconciliation/audit-logs", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const matchId = req.query.matchId as string | undefined;
      const filterUserId = req.query.userId as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "ReconciliationAuditLog",
        details: `Viewed audit logs${matchId ? ` for match ${matchId}` : ""}`
      });

      const logs = await iisDataReconciliationService.getAuditLogs(matchId, filterUserId, limit);

      res.json({
        success: true,
        data: logs,
        total: logs.length
      });
    } catch (error) {
      console.error("[IISReconciliation] Error fetching audit logs:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch audit logs" 
      });
    }
  });

  app.post("/api/iis-reconciliation/bulk-verify", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const userRole = req.headers["x-user-role"] as string || "clinician";
      const parsed = BulkAutoVerifySchema.parse(req.body);

      await logPhiAccess({
        userId,
        action: "write",
        resourceType: "ReconciliationBulkVerification",
        details: `Bulk auto-verification with threshold ${parsed.confidenceThreshold}`
      });

      const result = await iisDataReconciliationService.bulkAutoVerify(
        userId,
        userRole,
        parsed.confidenceThreshold
      );

      res.json({
        success: true,
        data: result,
        message: `Verified ${result.verified} records, ${result.skipped} skipped`,
        disclaimer: "Bulk verification applies only to high-confidence matches. All records should be periodically reviewed by qualified healthcare personnel."
      });
    } catch (error) {
      console.error("[IISReconciliation] Error in bulk verification:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to perform bulk verification" 
      });
    }
  });

  app.get("/api/iis-reconciliation/config", requireUser, async (req: Request, res: Response) => {
    try {
      const config = iisDataReconciliationService.getConfig();
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      console.error("[IISReconciliation] Error fetching config:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch configuration" 
      });
    }
  });

  app.patch("/api/iis-reconciliation/config", requireUser, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const parsed = UpdateConfigSchema.parse(req.body);

      await logPhiAccess({
        userId,
        action: "write",
        resourceType: "ReconciliationConfig",
        details: `Updated reconciliation configuration: ${JSON.stringify(parsed)}`
      });

      const config = iisDataReconciliationService.updateConfig(parsed);

      res.json({
        success: true,
        data: config,
        message: "Configuration updated successfully"
      });
    } catch (error) {
      console.error("[IISReconciliation] Error updating config:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to update configuration" 
      });
    }
  });

  console.log("[IISDataReconciliation] Routes registered at /api/iis-reconciliation/*");
}
