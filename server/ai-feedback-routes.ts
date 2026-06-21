import { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import type { AiFeedback, InsertAiFeedback, AiFeedbackStats, AiFeedbackType, TrendParameters, InsightPreferences } from "@shared/schema";
import { DEFAULT_TREND_PARAMETERS, DEFAULT_INSIGHT_PREFERENCES } from "@shared/schema";
import { logPhiAccess } from "./security/hipaa-audit";

const feedbackStore: Map<string, AiFeedback> = new Map();
const trendParamsStore: Map<string, TrendParameters> = new Map();
const insightPrefsStore: Map<string, InsightPreferences> = new Map();

export function registerAiFeedbackRoutes(app: Express) {
  app.post("/api/ai-feedback", async (req: Request, res: Response) => {
    try {
      const feedback: InsertAiFeedback = req.body;

      if (!feedback.feedbackType || !feedback.summaryId) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: feedbackType, summaryId",
        });
      }

      if (
        feedback.accuracyRating < 1 ||
        feedback.accuracyRating > 5 ||
        feedback.usefulnessRating < 1 ||
        feedback.usefulnessRating > 5
      ) {
        return res.status(400).json({
          success: false,
          error: "Ratings must be between 1 and 5",
        });
      }

      const userId = (req as any).user?.id || "anonymous";

      await logPhiAccess({
        userId,
        action: "write",
        resourceType: "AiFeedback",
        resourceId: feedback.summaryId,
        details: `Submitted ${feedback.feedbackType} feedback (accuracy: ${feedback.accuracyRating}, usefulness: ${feedback.usefulnessRating}${feedback.isInaccurate ? ", INACCURACY REPORTED" : ""})`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      const newFeedback: AiFeedback = {
        id: randomUUID(),
        feedbackType: feedback.feedbackType,
        summaryId: feedback.summaryId,
        userId,
        accuracyRating: feedback.accuracyRating,
        usefulnessRating: feedback.usefulnessRating,
        textFeedback: feedback.textFeedback,
        isInaccurate: feedback.isInaccurate || false,
        inaccuracyDetails: feedback.inaccuracyDetails,
        createdAt: new Date().toISOString(),
      };

      feedbackStore.set(newFeedback.id, newFeedback);

      res.json({
        success: true,
        data: newFeedback,
        message: feedback.isInaccurate
          ? "Thank you for reporting this issue. Our team will review it."
          : "Thank you for your feedback!",
      });
    } catch (error) {
      console.error("[AiFeedback] Error submitting feedback:", error);
      res.status(500).json({ success: false, error: "Failed to submit feedback" });
    }
  });

  app.get("/api/ai-feedback/stats", async (req: Request, res: Response) => {
    try {
      const { type } = req.query;

      const feedbackArray = Array.from(feedbackStore.values());
      const filteredFeedback = type
        ? feedbackArray.filter((f) => f.feedbackType === type)
        : feedbackArray;

      if (filteredFeedback.length === 0) {
        const stats: AiFeedbackStats = {
          feedbackType: (type as AiFeedbackType) || "document_summary",
          totalFeedback: 0,
          avgAccuracyRating: 0,
          avgUsefulnessRating: 0,
          inaccuracyReports: 0,
        };
        return res.json({ success: true, data: stats });
      }

      const totalAccuracy = filteredFeedback.reduce((sum, f) => sum + f.accuracyRating, 0);
      const totalUsefulness = filteredFeedback.reduce((sum, f) => sum + f.usefulnessRating, 0);
      const inaccuracyCount = filteredFeedback.filter((f) => f.isInaccurate).length;

      const stats: AiFeedbackStats = {
        feedbackType: (type as AiFeedbackType) || "all" as any,
        totalFeedback: filteredFeedback.length,
        avgAccuracyRating: Math.round((totalAccuracy / filteredFeedback.length) * 10) / 10,
        avgUsefulnessRating: Math.round((totalUsefulness / filteredFeedback.length) * 10) / 10,
        inaccuracyReports: inaccuracyCount,
      };

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error("[AiFeedback] Error fetching stats:", error);
      res.status(500).json({ success: false, error: "Failed to fetch feedback stats" });
    }
  });

  app.get("/api/ai-feedback/inaccuracy-reports", async (req: Request, res: Response) => {
    try {
      const feedbackArray = Array.from(feedbackStore.values());
      const inaccuracyReports = feedbackArray
        .filter((f) => f.isInaccurate)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ success: true, data: inaccuracyReports });
    } catch (error) {
      console.error("[AiFeedback] Error fetching inaccuracy reports:", error);
      res.status(500).json({ success: false, error: "Failed to fetch inaccuracy reports" });
    }
  });

  // Trend Parameters Routes
  app.get("/api/ai-feedback/trend-params/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const params = trendParamsStore.get(userId) || DEFAULT_TREND_PARAMETERS;
      res.json({ success: true, data: params });
    } catch (error) {
      console.error("[AiFeedback] Error fetching trend params:", error);
      res.status(500).json({ success: false, error: "Failed to fetch trend parameters" });
    }
  });

  app.post("/api/ai-feedback/trend-params/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const params: TrendParameters = req.body;
      
      // Basic validation
      if (!["low", "medium", "high"].includes(params.sensitivity)) {
        return res.status(400).json({ success: false, error: "Invalid sensitivity value" });
      }
      if (params.timeframeDays < 7 || params.timeframeDays > 365) {
        return res.status(400).json({ success: false, error: "Timeframe must be between 7 and 365 days" });
      }

      trendParamsStore.set(userId, params);

      await logPhiAccess({
        userId,
        action: "write",
        resourceType: "TrendParameters",
        resourceId: userId,
        details: `Updated trend parameters: sensitivity=${params.sensitivity}, timeframe=${params.timeframeDays} days`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      res.json({ success: true, data: params });
    } catch (error) {
      console.error("[AiFeedback] Error saving trend params:", error);
      res.status(500).json({ success: false, error: "Failed to save trend parameters" });
    }
  });

  // Insight Preferences Routes
  app.get("/api/ai-feedback/preferences/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const prefs = insightPrefsStore.get(userId) || { ...DEFAULT_INSIGHT_PREFERENCES, userId };
      res.json({ success: true, data: prefs });
    } catch (error) {
      console.error("[AiFeedback] Error fetching preferences:", error);
      res.status(500).json({ success: false, error: "Failed to fetch insight preferences" });
    }
  });

  app.post("/api/ai-feedback/preferences/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const prefs: InsightPreferences = { ...req.body, userId };
      
      // Basic validation
      if (!["summary", "standard", "detailed"].includes(prefs.detailLevel)) {
        return res.status(400).json({ success: false, error: "Invalid detail level" });
      }
      if (!["simple", "clinical"].includes(prefs.language)) {
        return res.status(400).json({ success: false, error: "Invalid language style" });
      }

      insightPrefsStore.set(userId, prefs);

      await logPhiAccess({
        userId,
        action: "write",
        resourceType: "InsightPreferences",
        resourceId: userId,
        details: `Updated insight preferences: detailLevel=${prefs.detailLevel}, language=${prefs.language}`,
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      });

      res.json({ success: true, data: prefs });
    } catch (error) {
      console.error("[AiFeedback] Error saving preferences:", error);
      res.status(500).json({ success: false, error: "Failed to save insight preferences" });
    }
  });

  console.log("[Routes] AI Feedback routes registered at /api/ai-feedback/*");
}
