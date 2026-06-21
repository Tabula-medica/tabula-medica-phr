import type { Express } from "express";
import { aiComplianceMonitoringService } from "./services/ai-compliance-monitoring";
import { createComplianceRuleSchema } from "@shared/schema";
import type {
  ComplianceRiskLevel,
  ComplianceRiskCategory,
  ComplianceRiskStatus,
  ComplianceRegulation,
} from "@shared/schema";

export function registerAIComplianceMonitoringRoutes(app: Express): void {
  app.post("/api/compliance/run", async (req, res) => {
    try {
      const { startDate, endDate, regulations, generateReport } = req.body as {
        startDate?: string;
        endDate?: string;
        regulations?: ComplianceRegulation[];
        generateReport?: boolean;
      };

      const userId = (req as any).user?.id || "anonymous";

      const result = await aiComplianceMonitoringService.runComplianceCheck({
        startDate,
        endDate,
        regulations,
        generateReport,
        userId,
      });

      res.json({
        success: true,
        score: result.score,
        risksFound: result.risks.length,
        risks: result.risks.map((r) => ({
          id: r.id,
          category: r.category,
          level: r.level,
          title: r.title,
          regulations: r.regulations,
          status: r.status,
          detectedAt: r.detectedAt,
        })),
        metrics: result.metrics,
        aiAnalysis: result.aiAnalysis,
        reportId: result.report?.id,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Run check error:", error);
      res.status(500).json({ success: false, error: "Failed to run compliance check" });
    }
  });

  app.get("/api/compliance/risks", async (req, res) => {
    try {
      const { status, level, category, regulation } = req.query;

      const filters: {
        status?: ComplianceRiskStatus;
        level?: ComplianceRiskLevel;
        category?: ComplianceRiskCategory;
        regulation?: ComplianceRegulation;
      } = {};

      if (status) filters.status = status as ComplianceRiskStatus;
      if (level) filters.level = level as ComplianceRiskLevel;
      if (category) filters.category = category as ComplianceRiskCategory;
      if (regulation) filters.regulation = regulation as ComplianceRegulation;

      const risks = aiComplianceMonitoringService.getRisks(filters);

      res.json({
        success: true,
        risks: risks.map((r) => ({
          id: r.id,
          category: r.category,
          level: r.level,
          title: r.title,
          description: r.description,
          regulations: r.regulations,
          affectedSystems: r.affectedSystems,
          status: r.status,
          detectedAt: r.detectedAt,
          remediationSuggestions: r.remediationSuggestions,
          hasAIAnalysis: !!r.aiAnalysis,
        })),
        total: risks.length,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get risks error:", error);
      res.status(500).json({ success: false, error: "Failed to get compliance risks" });
    }
  });

  app.get("/api/compliance/risks/summary", async (_req, res) => {
    try {
      const summary = aiComplianceMonitoringService.getRiskSummary();

      res.json({
        success: true,
        summary,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get risk summary error:", error);
      res.status(500).json({ success: false, error: "Failed to get risk summary" });
    }
  });

  app.get("/api/compliance/risks/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const risk = aiComplianceMonitoringService.getRisk(id);
      if (!risk) {
        return res.status(404).json({ success: false, error: "Risk not found" });
      }

      res.json({
        success: true,
        risk: {
          ...risk,
          evidence: risk.evidence.map((e) => ({
            type: e.type,
            count: e.count,
            timeRange: e.timeRange,
          })),
        },
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get risk error:", error);
      res.status(500).json({ success: false, error: "Failed to get compliance risk" });
    }
  });

  app.patch("/api/compliance/risks/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body as {
        status: ComplianceRiskStatus;
        notes?: string;
      };

      const userId = (req as any).user?.id || "anonymous";

      const validStatuses: ComplianceRiskStatus[] = [
        "open",
        "acknowledged",
        "investigating",
        "remediated",
        "accepted",
        "false_positive",
      ];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, error: "Invalid status" });
      }

      const risk = aiComplianceMonitoringService.updateRiskStatus(id, status, userId, notes);
      if (!risk) {
        return res.status(404).json({ success: false, error: "Risk not found" });
      }

      res.json({
        success: true,
        risk: {
          id: risk.id,
          status: risk.status,
          acknowledgedAt: risk.acknowledgedAt,
          remediatedAt: risk.remediatedAt,
        },
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Update risk status error:", error);
      res.status(500).json({ success: false, error: "Failed to update risk status" });
    }
  });

  app.get("/api/compliance/reports", async (req, res) => {
    try {
      const { type, regulation } = req.query;

      const filters: {
        type?: "daily" | "weekly" | "monthly" | "on_demand" | "incident";
        regulation?: ComplianceRegulation;
      } = {};

      if (type) filters.type = type as typeof filters.type;
      if (regulation) filters.regulation = regulation as ComplianceRegulation;

      const reports = aiComplianceMonitoringService.getReports(filters);

      res.json({
        success: true,
        reports: reports.map((r) => ({
          id: r.id,
          type: r.type,
          regulations: r.regulations,
          period: r.period,
          generatedAt: r.generatedAt,
          summary: {
            overallScore: r.summary.overallScore,
            totalFindings: r.summary.totalFindings,
            criticalCount: r.summary.riskCounts.critical,
            highCount: r.summary.riskCounts.high,
          },
        })),
        total: reports.length,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get reports error:", error);
      res.status(500).json({ success: false, error: "Failed to get compliance reports" });
    }
  });

  app.get("/api/compliance/reports/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const report = aiComplianceMonitoringService.getReport(id);
      if (!report) {
        return res.status(404).json({ success: false, error: "Report not found" });
      }

      res.json({
        success: true,
        report,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get report error:", error);
      res.status(500).json({ success: false, error: "Failed to get compliance report" });
    }
  });

  app.get("/api/compliance/metrics", async (_req, res) => {
    try {
      const metrics = aiComplianceMonitoringService.getMetrics();

      res.json({
        success: true,
        metrics,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get metrics error:", error);
      res.status(500).json({ success: false, error: "Failed to get compliance metrics" });
    }
  });

  app.get("/api/compliance/rules", async (_req, res) => {
    try {
      const rules = aiComplianceMonitoringService.getRuleConfigs();

      res.json({
        success: true,
        rules: rules.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          enabled: r.enabled,
          regulation: r.regulation,
          category: r.category,
          severity: r.severity,
          conditionCount: r.conditions.length,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        total: rules.length,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get rules error:", error);
      res.status(500).json({ success: false, error: "Failed to get compliance rules" });
    }
  });

  app.get("/api/compliance/rules/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const rule = aiComplianceMonitoringService.getRuleConfig(id);
      if (!rule) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }

      res.json({
        success: true,
        rule,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Get rule error:", error);
      res.status(500).json({ success: false, error: "Failed to get compliance rule" });
    }
  });

  app.post("/api/compliance/rules", async (req, res) => {
    try {
      const parseResult = createComplianceRuleSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: "Invalid rule configuration",
          details: parseResult.error.errors,
        });
      }

      const rule = aiComplianceMonitoringService.addRuleConfig(parseResult.data);

      res.json({
        success: true,
        rule,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Add rule error:", error);
      res.status(500).json({ success: false, error: "Failed to add compliance rule" });
    }
  });

  app.patch("/api/compliance/rules/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const rule = aiComplianceMonitoringService.updateRuleConfig(id, updates);
      if (!rule) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }

      res.json({
        success: true,
        rule,
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Update rule error:", error);
      res.status(500).json({ success: false, error: "Failed to update compliance rule" });
    }
  });

  app.delete("/api/compliance/rules/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const deleted = aiComplianceMonitoringService.deleteRuleConfig(id);
      if (!deleted) {
        return res.status(404).json({ success: false, error: "Rule not found" });
      }

      res.json({
        success: true,
        message: "Rule deleted successfully",
      });
    } catch (error) {
      console.error("[ComplianceMonitoring] Delete rule error:", error);
      res.status(500).json({ success: false, error: "Failed to delete compliance rule" });
    }
  });

  console.log("[ComplianceMonitoring] Routes registered successfully");
}
