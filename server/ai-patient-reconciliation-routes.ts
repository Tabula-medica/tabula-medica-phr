import type { Express } from "express";
import { 
  aiPatientReconciliationEngine,
  type PatientRecord,
  type MatchCandidate,
  type MergeStrategy
} from "./services/ai-patient-reconciliation-engine";

export function registerAIPatientReconciliationRoutes(app: Express): void {
  app.get("/api/patient-reconciliation/records", async (_req, res) => {
    try {
      const { sourceSystem, hasMatches } = _req.query;
      
      const filters: { sourceSystem?: string; hasMatches?: boolean } = {};
      if (sourceSystem) filters.sourceSystem = sourceSystem as string;
      if (hasMatches !== undefined) filters.hasMatches = hasMatches === "true";

      const records = aiPatientReconciliationEngine.getPatientRecords(filters);
      
      res.json({
        success: true,
        records: records.map((r) => ({
          id: r.id,
          sourceSystem: r.sourceSystem,
          dataFields: Object.keys(r.data),
          fieldCount: Object.keys(r.data).length,
          confidence: r.metadata.confidence,
          lastUpdated: r.metadata.lastUpdated,
        })),
        total: records.length,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get records error:", error);
      res.status(500).json({ success: false, error: "Failed to get patient records" });
    }
  });

  app.post("/api/patient-reconciliation/records", async (req, res) => {
    try {
      const record = req.body as Omit<PatientRecord, "id">;
      
      if (!record.sourceSystem || !record.sourceId || !record.data) {
        return res.status(400).json({
          success: false,
          error: "sourceSystem, sourceId, and data are required",
        });
      }

      const newRecord = await aiPatientReconciliationEngine.addPatientRecord(record);
      
      res.json({
        success: true,
        record: {
          id: newRecord.id,
          sourceSystem: newRecord.sourceSystem,
          dataFields: Object.keys(newRecord.data),
        },
      });
    } catch (error) {
      console.error("[PatientReconciliation] Add record error:", error);
      res.status(500).json({ success: false, error: "Failed to add patient record" });
    }
  });

  app.post("/api/patient-reconciliation/find-duplicates", async (req, res) => {
    try {
      const { recordId } = req.body as { recordId?: string };
      
      const candidates = await aiPatientReconciliationEngine.findDuplicates(recordId);
      
      res.json({
        success: true,
        candidates: candidates.map((c) => ({
          id: c.id,
          overallScore: c.overallScore,
          matchType: c.matchType,
          status: c.status,
          sourceSystems: [c.record1.sourceSystem, c.record2.sourceSystem],
          fieldScoresSummary: {
            exact: c.fieldScores.filter((f) => f.isExact).length,
            high: c.fieldScores.filter((f) => f.score >= 0.8 && !f.isExact).length,
            low: c.fieldScores.filter((f) => f.score < 0.8).length,
            total: c.fieldScores.length,
          },
          createdAt: c.createdAt,
        })),
        totalFound: candidates.length,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Find duplicates error:", error);
      res.status(500).json({ success: false, error: "Failed to find duplicates" });
    }
  });

  app.get("/api/patient-reconciliation/candidates", async (req, res) => {
    try {
      const { status, matchType, minScore } = req.query;
      
      const filters: {
        status?: MatchCandidate["status"];
        matchType?: MatchCandidate["matchType"];
        minScore?: number;
      } = {};
      
      if (status) filters.status = status as MatchCandidate["status"];
      if (matchType) filters.matchType = matchType as MatchCandidate["matchType"];
      if (minScore) filters.minScore = parseFloat(minScore as string);

      const candidates = aiPatientReconciliationEngine.getMatchCandidates(filters);
      
      res.json({
        success: true,
        candidates: candidates.map((c) => ({
          id: c.id,
          overallScore: c.overallScore,
          matchType: c.matchType,
          status: c.status,
          sourceSystems: [c.record1.sourceSystem, c.record2.sourceSystem],
          fieldScoresSummary: {
            exact: c.fieldScores.filter((f) => f.isExact).length,
            high: c.fieldScores.filter((f) => f.score >= 0.8 && !f.isExact).length,
            low: c.fieldScores.filter((f) => f.score < 0.8).length,
          },
          hasAIAnalysis: !!c.aiAnalysis,
          createdAt: c.createdAt,
          reviewedAt: c.reviewedAt,
        })),
        total: candidates.length,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get candidates error:", error);
      res.status(500).json({ success: false, error: "Failed to get match candidates" });
    }
  });

  app.get("/api/patient-reconciliation/candidates/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const maskedCandidate = aiPatientReconciliationEngine.getMaskedCandidate(id);
      if (!maskedCandidate) {
        return res.status(404).json({ success: false, error: "Match candidate not found" });
      }
      
      res.json({
        success: true,
        candidate: maskedCandidate,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get candidate error:", error);
      res.status(500).json({ success: false, error: "Failed to get match candidate" });
    }
  });

  app.post("/api/patient-reconciliation/candidates/:id/analyze", async (req, res) => {
    try {
      const { id } = req.params;
      
      const analysis = await aiPatientReconciliationEngine.getAIMatchAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ success: false, error: "Match candidate not found" });
      }
      
      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      console.error("[PatientReconciliation] AI analysis error:", error);
      res.status(500).json({ success: false, error: "Failed to generate AI analysis" });
    }
  });

  app.patch("/api/patient-reconciliation/candidates/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body as {
        status: MatchCandidate["status"];
        notes?: string;
      };
      
      const userId = (req as any).user?.id || "anonymous";
      
      if (!status) {
        return res.status(400).json({ success: false, error: "status is required" });
      }

      const candidate = await aiPatientReconciliationEngine.updateCandidateStatus(
        id,
        status,
        userId,
        notes
      );
      
      if (!candidate) {
        return res.status(404).json({ success: false, error: "Match candidate not found" });
      }
      
      res.json({
        success: true,
        candidate: {
          id: candidate.id,
          status: candidate.status,
          reviewedAt: candidate.reviewedAt,
        },
      });
    } catch (error) {
      console.error("[PatientReconciliation] Update status error:", error);
      res.status(500).json({ success: false, error: "Failed to update candidate status" });
    }
  });

  app.post("/api/patient-reconciliation/candidates/:id/merge", async (req, res) => {
    try {
      const { id } = req.params;
      const { strategyId, manualResolutions } = req.body as {
        strategyId?: string;
        manualResolutions?: Record<string, unknown>;
      };
      
      const userId = (req as any).user?.id || "anonymous";
      
      const merged = await aiPatientReconciliationEngine.mergePatients(
        id,
        userId,
        strategyId,
        manualResolutions
      );
      
      if (!merged) {
        return res.status(404).json({ success: false, error: "Match candidate or strategy not found" });
      }
      
      res.json({
        success: true,
        mergedPatient: {
          id: merged.id,
          sourceRecordIds: merged.sourceRecordIds,
          conflictCount: merged.conflicts.length,
          resolvedConflicts: merged.conflicts.filter((c) => c.resolved).length,
          qualityScore: merged.qualityScore,
          createdAt: merged.createdAt,
        },
      });
    } catch (error) {
      console.error("[PatientReconciliation] Merge error:", error);
      res.status(500).json({ success: false, error: "Failed to merge patients" });
    }
  });

  app.get("/api/patient-reconciliation/merged", async (_req, res) => {
    try {
      const merged = aiPatientReconciliationEngine.getMergedPatients();
      
      res.json({
        success: true,
        mergedPatients: merged.map((m) => ({
          id: m.id,
          sourceRecordCount: m.sourceRecordIds.length,
          conflictCount: m.conflicts.length,
          qualityScore: m.qualityScore,
          strategyName: m.mergeStrategy.name,
          createdAt: m.createdAt,
        })),
        total: merged.length,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get merged error:", error);
      res.status(500).json({ success: false, error: "Failed to get merged patients" });
    }
  });

  app.get("/api/patient-reconciliation/merged/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      const merged = aiPatientReconciliationEngine.getMergedPatient(id);
      if (!merged) {
        return res.status(404).json({ success: false, error: "Merged patient not found" });
      }
      
      res.json({
        success: true,
        mergedPatient: {
          id: merged.id,
          sourceRecordCount: merged.sourceRecordIds.length,
          mergeStrategy: {
            id: merged.mergeStrategy.id,
            name: merged.mergeStrategy.name,
            description: merged.mergeStrategy.description,
            fieldCount: Object.keys(merged.mergeStrategy.fieldStrategies).length,
          },
          conflicts: merged.conflicts.map((c) => ({
            fieldName: c.fieldName,
            valueCount: c.values.length,
            resolved: c.resolved,
            resolution: c.resolution,
          })),
          qualityScore: merged.qualityScore,
          auditEntryCount: merged.auditTrail.length,
          createdAt: merged.createdAt,
        },
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get merged patient error:", error);
      res.status(500).json({ success: false, error: "Failed to get merged patient" });
    }
  });

  app.get("/api/patient-reconciliation/strategies", async (_req, res) => {
    try {
      const strategies = aiPatientReconciliationEngine.getMergeStrategies();
      
      res.json({
        success: true,
        strategies,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get strategies error:", error);
      res.status(500).json({ success: false, error: "Failed to get merge strategies" });
    }
  });

  app.post("/api/patient-reconciliation/strategies", async (req, res) => {
    try {
      const strategy = req.body as Omit<MergeStrategy, "id">;
      
      if (!strategy.name || !strategy.fieldStrategies) {
        return res.status(400).json({
          success: false,
          error: "name and fieldStrategies are required",
        });
      }

      const newStrategy = aiPatientReconciliationEngine.addMergeStrategy(strategy);
      
      res.json({
        success: true,
        strategy: newStrategy,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Add strategy error:", error);
      res.status(500).json({ success: false, error: "Failed to add merge strategy" });
    }
  });

  app.get("/api/patient-reconciliation/stats", async (_req, res) => {
    try {
      const stats = aiPatientReconciliationEngine.getReconciliationStats();
      
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get stats error:", error);
      res.status(500).json({ success: false, error: "Failed to get reconciliation stats" });
    }
  });

  app.get("/api/patient-reconciliation/config", async (_req, res) => {
    try {
      const config = aiPatientReconciliationEngine.getConfig();
      
      res.json({
        success: true,
        config,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Get config error:", error);
      res.status(500).json({ success: false, error: "Failed to get configuration" });
    }
  });

  app.patch("/api/patient-reconciliation/config", async (req, res) => {
    try {
      const updates = req.body;
      
      const config = aiPatientReconciliationEngine.updateConfig(updates);
      
      res.json({
        success: true,
        config,
      });
    } catch (error) {
      console.error("[PatientReconciliation] Update config error:", error);
      res.status(500).json({ success: false, error: "Failed to update configuration" });
    }
  });

  console.log("[Routes] AI Patient Reconciliation Engine routes registered at /api/patient-reconciliation/*");
}
