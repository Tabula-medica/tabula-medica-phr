import type { Express, Request, Response } from "express";
import { aiDataHarmonizationService } from "./services/ai-data-harmonization-service";

const HIPAA_DISCLAIMER = "This harmonized data is for informational purposes only. Not for clinical decision-making.";

export function registerAIDataHarmonizationRoutes(app: Express): void {
  console.log("[HIPAA-AUDIT][AIDataHarmonization] Registering AI Data Harmonization routes");

  app.get("/api/data-harmonization/stats", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataHarmonization] STATS_REQUEST - Fetching harmonization statistics");
      const stats = aiDataHarmonizationService.getStats();
      res.json({ ...stats, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Stats error:", error);
      res.status(500).json({ error: "Failed to fetch harmonization stats" });
    }
  });

  app.get("/api/data-harmonization/patient-records", async (req: Request, res: Response) => {
    try {
      const { sourceId } = req.query;
      console.log("[HIPAA-AUDIT][DataHarmonization] PATIENT_RECORDS_REQUEST - Fetching source patient records");
      
      const records = aiDataHarmonizationService.getPatientRecords(sourceId as string | undefined);
      res.json({ records, total: records.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Patient records error:", error);
      res.status(500).json({ error: "Failed to fetch patient records" });
    }
  });

  app.get("/api/data-harmonization/match-candidates", async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      console.log("[HIPAA-AUDIT][DataHarmonization] MATCH_CANDIDATES_REQUEST - Fetching match candidates");
      
      const candidates = aiDataHarmonizationService.getMatchCandidates(status as string | undefined);
      
      const summary = {
        total: candidates.length,
        pending: candidates.filter(c => c.status === 'pending_review').length,
        confirmed: candidates.filter(c => c.status === 'confirmed').length,
        rejected: candidates.filter(c => c.status === 'rejected').length,
        autoLinked: candidates.filter(c => c.status === 'auto_linked').length
      };

      res.json({ candidates, summary, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Match candidates error:", error);
      res.status(500).json({ error: "Failed to fetch match candidates" });
    }
  });

  app.post("/api/data-harmonization/find-matches/:recordId", async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      console.log(`[HIPAA-AUDIT][DataHarmonization] FIND_MATCHES - Finding matches for record ${recordId}`);
      
      const matches = await aiDataHarmonizationService.findMatches(recordId);
      res.json({ matches, total: matches.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Find matches error:", error);
      res.status(500).json({ error: "Failed to find matches" });
    }
  });

  app.patch("/api/data-harmonization/matches/:matchId/confirm", async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const { reviewedBy } = req.body;
      
      const match = aiDataHarmonizationService.confirmMatch(matchId, reviewedBy || 'system');
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      res.json({ match, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Confirm match error:", error);
      res.status(500).json({ error: "Failed to confirm match" });
    }
  });

  app.patch("/api/data-harmonization/matches/:matchId/reject", async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const { reviewedBy } = req.body;
      
      const match = aiDataHarmonizationService.rejectMatch(matchId, reviewedBy || 'system');
      if (!match) {
        return res.status(404).json({ error: "Match not found" });
      }

      res.json({ match, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Reject match error:", error);
      res.status(500).json({ error: "Failed to reject match" });
    }
  });

  app.get("/api/data-harmonization/unified-records", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataHarmonization] UNIFIED_RECORDS_REQUEST - Fetching unified patient records");
      
      const records = aiDataHarmonizationService.getUnifiedRecords();
      res.json({ records, total: records.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Unified records error:", error);
      res.status(500).json({ error: "Failed to fetch unified records" });
    }
  });

  app.get("/api/data-harmonization/unified-records/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`[HIPAA-AUDIT][DataHarmonization] UNIFIED_RECORD_DETAIL - Fetching unified record ${id}`);
      
      const record = aiDataHarmonizationService.getUnifiedRecordById(id);
      if (!record) {
        return res.status(404).json({ error: "Unified record not found" });
      }

      res.json({ record, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Unified record detail error:", error);
      res.status(500).json({ error: "Failed to fetch unified record" });
    }
  });

  app.get("/api/data-harmonization/query", async (req: Request, res: Response) => {
    try {
      const { identifier, name, birthDate, gender } = req.query;
      console.log("[HIPAA-AUDIT][DataHarmonization] QUERY_UNIFIED - Querying unified patient view");
      
      const results = aiDataHarmonizationService.queryUnifiedPatient({
        identifier: identifier as string | undefined,
        name: name as string | undefined,
        birthDate: birthDate as string | undefined,
        gender: gender as string | undefined
      });

      res.json({ results, total: results.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Query error:", error);
      res.status(500).json({ error: "Failed to query unified patients" });
    }
  });

  app.patch("/api/data-harmonization/unified-records/:recordId/conflicts/:conflictId/resolve", async (req: Request, res: Response) => {
    try {
      const { recordId, conflictId } = req.params;
      const { selectedValue, method, resolvedBy } = req.body;

      if (!selectedValue || !method) {
        return res.status(400).json({ error: "selectedValue and method are required" });
      }

      const conflict = await aiDataHarmonizationService.resolveConflict(recordId, conflictId, {
        selectedValue,
        method,
        resolvedBy
      });

      if (!conflict) {
        return res.status(404).json({ error: "Conflict not found" });
      }

      res.json({ conflict, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Resolve conflict error:", error);
      res.status(500).json({ error: "Failed to resolve conflict" });
    }
  });

  app.post("/api/data-harmonization/unified-records/:id/enrich", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`[HIPAA-AUDIT][DataHarmonization] GENERATE_ENRICHMENTS - Generating enrichments for ${id}`);
      
      const enrichments = await aiDataHarmonizationService.generateEnrichments(id);
      res.json({ enrichments, total: enrichments.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Generate enrichments error:", error);
      res.status(500).json({ error: "Failed to generate enrichments" });
    }
  });

  app.post("/api/data-harmonization/harmonize-version", async (req: Request, res: Response) => {
    try {
      const { record, sourceVersion, targetVersion } = req.body;

      if (!record || !sourceVersion) {
        return res.status(400).json({ error: "record and sourceVersion are required" });
      }

      console.log(`[HIPAA-AUDIT][DataHarmonization] HARMONIZE_VERSION - Converting ${sourceVersion} to ${targetVersion || 'R4'}`);
      
      const harmonized = aiDataHarmonizationService.harmonizeVersion(record, sourceVersion, targetVersion);
      res.json({ 
        original: record,
        harmonized,
        sourceVersion,
        targetVersion: targetVersion || 'R4',
        disclaimer: HIPAA_DISCLAIMER 
      });
    } catch (error) {
      console.error("[DataHarmonization] Harmonize version error:", error);
      res.status(500).json({ error: "Failed to harmonize version" });
    }
  });

  app.get("/api/data-harmonization/rules", async (_req: Request, res: Response) => {
    try {
      console.log("[HIPAA-AUDIT][DataHarmonization] RULES_REQUEST - Fetching harmonization rules");
      const rules = aiDataHarmonizationService.getHarmonizationRules();
      res.json({ rules, total: rules.length, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Rules error:", error);
      res.status(500).json({ error: "Failed to fetch harmonization rules" });
    }
  });

  app.post("/api/data-harmonization/rules", async (req: Request, res: Response) => {
    try {
      const ruleData = req.body;

      if (!ruleData.name || !ruleData.field || !ruleData.action) {
        return res.status(400).json({ error: "name, field, and action are required" });
      }

      const rule = aiDataHarmonizationService.createHarmonizationRule(ruleData);
      res.status(201).json({ rule, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Create rule error:", error);
      res.status(500).json({ error: "Failed to create harmonization rule" });
    }
  });

  app.patch("/api/data-harmonization/rules/:ruleId", async (req: Request, res: Response) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;

      const rule = aiDataHarmonizationService.updateHarmonizationRule(ruleId, updates);
      if (!rule) {
        return res.status(404).json({ error: "Rule not found" });
      }

      res.json({ rule, success: true, disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Update rule error:", error);
      res.status(500).json({ error: "Failed to update harmonization rule" });
    }
  });

  app.delete("/api/data-harmonization/rules/:ruleId", async (req: Request, res: Response) => {
    try {
      const { ruleId } = req.params;
      const deleted = aiDataHarmonizationService.deleteHarmonizationRule(ruleId);

      if (!deleted) {
        return res.status(404).json({ error: "Rule not found" });
      }

      res.json({ success: true, message: "Rule deleted", disclaimer: HIPAA_DISCLAIMER });
    } catch (error) {
      console.error("[DataHarmonization] Delete rule error:", error);
      res.status(500).json({ error: "Failed to delete harmonization rule" });
    }
  });

  console.log("[HIPAA-AUDIT][AIDataHarmonization] Routes registered successfully at /api/data-harmonization/*");
}
