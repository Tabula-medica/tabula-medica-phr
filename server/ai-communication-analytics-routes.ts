import { Express } from "express";
import { requireUser, getUserId } from "./middleware/require-user";
import {
  analyzeMessage,
  analyzeBatch,
  getUrgentFlags,
  reviewUrgentFlag,
  getAnalyticsOverview,
  getPatientCommunicationHistory,
  getSentimentTrend,
  getCommunicationPatterns,
  extractPatientQuestions,
  answerPatientQuestion,
  trackPortalInteraction,
  getPortalEngagementMetrics,
  getAlertConfigurations,
  updateAlertConfiguration,
  createAlertConfiguration,
  getActiveAlerts,
  acknowledgeAlert,
  resolveAlert,
  escalateAlert,
  getAlertStats,
  generateResponseTemplate,
  generatePatientMessageSummary,
  getCareTeamNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  exportAnalyticsData,
  CommunicationMessage
} from "./services/ai-communication-analytics-service";

const NO_CDS_DISCLAIMER = "IMPORTANT: This AI-powered communication analysis is for INFORMATIONAL and OPERATIONAL purposes only. It is NOT a substitute for clinical judgment or diagnosis. All flagged concerns must be reviewed by qualified healthcare professionals. This system does NOT provide clinical decision support.";

function logHipaaAudit(action: string, userId: string, patientId?: string, details?: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][CommAnalyticsRoutes] ${timestamp} | Action: ${action} | User: ${userId} | Patient: ${patientId || 'N/A'} | Details: ${details || 'N/A'}`);
}

export function registerCommunicationAnalyticsRoutes(app: Express) {
  app.post("/api/communication-analytics/analyze", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const message: CommunicationMessage = req.body;
      
      if (!message.id || !message.patientId || !message.content) {
        return res.status(400).json({ 
          error: "Message id, patientId, and content are required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      if (!message.messageType) {
        message.messageType = "portal_message";
      }
      if (!message.direction) {
        message.direction = "inbound";
      }
      if (!message.timestamp) {
        message.timestamp = new Date().toISOString();
      }
      
      logHipaaAudit("ANALYZE_MESSAGE_REQUEST", userId, message.patientId, `Message ID: ${message.id}`);
      
      const result = await analyzeMessage(userId, message);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error analyzing message:", error);
      res.status(500).json({ 
        error: "Failed to analyze message",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.post("/api/communication-analytics/analyze-batch", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { messages } = req.body;
      
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ 
          error: "Messages array is required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("ANALYZE_BATCH_REQUEST", userId, undefined, `Batch size: ${messages.length}`);
      
      const result = await analyzeBatch(userId, messages);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error analyzing batch:", error);
      res.status(500).json({ 
        error: "Failed to analyze message batch",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/urgent-flags", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      logHipaaAudit("GET_URGENT_FLAGS_REQUEST", userId, undefined, "Fetching urgent flags");
      
      const result = getUrgentFlags(userId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching urgent flags:", error);
      res.status(500).json({ 
        error: "Failed to fetch urgent flags",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.patch("/api/communication-analytics/urgent-flags/:flagId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { flagId } = req.params;
      const { status, notes } = req.body;
      
      if (!status || !["reviewed", "escalated", "resolved"].includes(status)) {
        return res.status(400).json({ 
          error: "Valid status (reviewed, escalated, resolved) is required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("REVIEW_FLAG_REQUEST", userId, undefined, `Flag ID: ${flagId}, Status: ${status}`);
      
      const result = reviewUrgentFlag(userId, flagId, status, notes);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error reviewing flag:", error);
      res.status(500).json({ 
        error: "Failed to review urgent flag",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/overview", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      logHipaaAudit("GET_OVERVIEW_REQUEST", userId, undefined, "Fetching analytics overview");
      
      const result = getAnalyticsOverview(userId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching overview:", error);
      res.status(500).json({ 
        error: "Failed to fetch analytics overview",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/patient/:patientId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { patientId } = req.params;
      
      logHipaaAudit("GET_PATIENT_HISTORY_REQUEST", userId, patientId, "Fetching patient communication history");
      
      const result = getPatientCommunicationHistory(userId, patientId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching patient history:", error);
      res.status(500).json({ 
        error: "Failed to fetch patient communication history",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  // ============================================================================
  // ENHANCED: Trend Detection & Communication Patterns
  // ============================================================================

  app.get("/api/communication-analytics/trends/:patientId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { patientId } = req.params;
      const period = (req.query.period as "7d" | "30d" | "90d") || "30d";
      
      logHipaaAudit("GET_SENTIMENT_TREND_REQUEST", userId, patientId, `Period: ${period}`);
      
      const result = await getSentimentTrend(userId, patientId, period);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching sentiment trend:", error);
      res.status(500).json({ 
        error: "Failed to fetch sentiment trend",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/patterns/:patientId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { patientId } = req.params;
      
      logHipaaAudit("GET_PATTERNS_REQUEST", userId, patientId, "Fetching communication patterns");
      
      const result = await getCommunicationPatterns(userId, patientId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching patterns:", error);
      res.status(500).json({ 
        error: "Failed to fetch communication patterns",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/questions/:patientId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { patientId } = req.params;
      const includeAnswered = req.query.includeAnswered === "true";
      
      logHipaaAudit("GET_QUESTIONS_REQUEST", userId, patientId, `Include answered: ${includeAnswered}`);
      
      const result = await extractPatientQuestions(userId, patientId, includeAnswered);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching questions:", error);
      res.status(500).json({ 
        error: "Failed to fetch patient questions",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.patch("/api/communication-analytics/questions/:questionId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { questionId } = req.params;
      const { answered } = req.body;
      
      logHipaaAudit("ANSWER_QUESTION_REQUEST", userId, undefined, `Question ID: ${questionId}`);
      
      const result = await answerPatientQuestion(userId, questionId, answered);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error updating question:", error);
      res.status(500).json({ 
        error: "Failed to update question status",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  // ============================================================================
  // ENHANCED: Portal Interaction Tracking
  // ============================================================================

  app.post("/api/communication-analytics/portal-interactions", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const interaction = req.body;
      
      if (!interaction.patientId || !interaction.eventType || !interaction.sessionId) {
        return res.status(400).json({
          error: "patientId, sessionId, and eventType are required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      if (!interaction.timestamp) {
        interaction.timestamp = new Date().toISOString();
      }
      
      logHipaaAudit("TRACK_INTERACTION_REQUEST", userId, interaction.patientId, `Event: ${interaction.eventType}`);
      
      const result = trackPortalInteraction(userId, interaction);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error tracking interaction:", error);
      res.status(500).json({ 
        error: "Failed to track portal interaction",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/engagement/:patientId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { patientId } = req.params;
      
      logHipaaAudit("GET_ENGAGEMENT_REQUEST", userId, patientId, "Fetching engagement metrics");
      
      const result = getPortalEngagementMetrics(userId, patientId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching engagement:", error);
      res.status(500).json({ 
        error: "Failed to fetch engagement metrics",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  // ============================================================================
  // ENHANCED: Automated Alerts System
  // ============================================================================

  app.get("/api/communication-analytics/alert-configs", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      logHipaaAudit("GET_ALERT_CONFIGS_REQUEST", userId, undefined, "Fetching alert configurations");
      
      const result = getAlertConfigurations(userId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching alert configs:", error);
      res.status(500).json({ 
        error: "Failed to fetch alert configurations",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.post("/api/communication-analytics/alert-configs", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const config = req.body;
      
      if (!config.name || !config.triggerType) {
        return res.status(400).json({
          error: "name and triggerType are required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("CREATE_ALERT_CONFIG_REQUEST", userId, undefined, `Name: ${config.name}`);
      
      const result = createAlertConfiguration(userId, config);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error creating alert config:", error);
      res.status(500).json({ 
        error: "Failed to create alert configuration",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.patch("/api/communication-analytics/alert-configs/:configId", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { configId } = req.params;
      const updates = req.body;
      
      logHipaaAudit("UPDATE_ALERT_CONFIG_REQUEST", userId, undefined, `Config ID: ${configId}`);
      
      const result = updateAlertConfiguration(userId, configId, updates);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error updating alert config:", error);
      res.status(500).json({ 
        error: "Failed to update alert configuration",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/alerts", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const filters: any = {};
      
      if (req.query.patientId) filters.patientId = req.query.patientId;
      if (req.query.severity) filters.severity = req.query.severity;
      if (req.query.status) filters.status = req.query.status;
      
      logHipaaAudit("GET_ALERTS_REQUEST", userId, filters.patientId, `Filters: ${JSON.stringify(filters)}`);
      
      const result = getActiveAlerts(userId, filters);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching alerts:", error);
      res.status(500).json({ 
        error: "Failed to fetch alerts",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.get("/api/communication-analytics/alerts/stats", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      logHipaaAudit("GET_ALERT_STATS_REQUEST", userId, undefined, "Fetching alert statistics");
      
      const result = getAlertStats(userId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching alert stats:", error);
      res.status(500).json({ 
        error: "Failed to fetch alert statistics",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.post("/api/communication-analytics/alerts/:alertId/acknowledge", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { alertId } = req.params;
      
      logHipaaAudit("ACKNOWLEDGE_ALERT_REQUEST", userId, undefined, `Alert ID: ${alertId}`);
      
      const result = acknowledgeAlert(userId, alertId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error acknowledging alert:", error);
      res.status(500).json({ 
        error: "Failed to acknowledge alert",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.post("/api/communication-analytics/alerts/:alertId/resolve", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { alertId } = req.params;
      const { resolution } = req.body;
      
      if (!resolution) {
        return res.status(400).json({
          error: "resolution is required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("RESOLVE_ALERT_REQUEST", userId, undefined, `Alert ID: ${alertId}`);
      
      const result = resolveAlert(userId, alertId, resolution);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error resolving alert:", error);
      res.status(500).json({ 
        error: "Failed to resolve alert",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.post("/api/communication-analytics/alerts/:alertId/escalate", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { alertId } = req.params;
      const { escalateTo, reason } = req.body;
      
      if (!escalateTo || !reason) {
        return res.status(400).json({
          error: "escalateTo and reason are required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("ESCALATE_ALERT_REQUEST", userId, undefined, `Alert ID: ${alertId}, To: ${escalateTo}`);
      
      const result = escalateAlert(userId, alertId, escalateTo, reason);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error escalating alert:", error);
      res.status(500).json({ 
        error: "Failed to escalate alert",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  // ============================================
  // AI RESPONSE TEMPLATES
  // ============================================

  app.post("/api/communication-analytics/response-templates", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { message, context } = req.body;
      
      if (!message || !message.id || !message.patientId || !message.content) {
        return res.status(400).json({
          error: "Message with id, patientId, and content is required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("GENERATE_RESPONSE_TEMPLATES_REQUEST", userId, message.patientId, `Message ID: ${message.id}`);
      
      const result = await generateResponseTemplate(userId, message, context);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error generating response templates:", error);
      res.status(500).json({
        error: "Failed to generate response templates",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  // ============================================
  // PATIENT MESSAGE SUMMARY
  // ============================================

  app.post("/api/communication-analytics/patient-summary", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { patientId, messages, periodDays } = req.body;
      
      if (!patientId || !messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: "patientId and messages array are required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("GENERATE_PATIENT_SUMMARY_REQUEST", userId, patientId, `Messages: ${messages.length}`);
      
      const result = await generatePatientMessageSummary(userId, patientId, messages, periodDays || 30);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error generating patient summary:", error);
      res.status(500).json({
        error: "Failed to generate patient summary",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  // ============================================
  // CARE TEAM NOTIFICATIONS
  // ============================================

  app.get("/api/communication-analytics/notifications", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { unreadOnly, patientId, type, priority } = req.query;
      
      logHipaaAudit("GET_NOTIFICATIONS_REQUEST", userId, patientId as string, "Fetching notifications");
      
      const result = getCareTeamNotifications(userId, {
        unreadOnly: unreadOnly === "true",
        patientId: patientId as string,
        type: type as string,
        priority: priority as string
      });
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error fetching notifications:", error);
      res.status(500).json({
        error: "Failed to fetch notifications",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.post("/api/communication-analytics/notifications/:id/read", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      logHipaaAudit("MARK_NOTIFICATION_READ_REQUEST", userId, undefined, `Notification ID: ${id}`);
      
      const result = markNotificationRead(userId, id);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error marking notification read:", error);
      res.status(500).json({
        error: "Failed to mark notification read",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  app.post("/api/communication-analytics/notifications/read-all", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      
      logHipaaAudit("MARK_ALL_NOTIFICATIONS_READ_REQUEST", userId, undefined, "Marking all read");
      
      const result = markAllNotificationsRead(userId);
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error marking all notifications read:", error);
      res.status(500).json({
        error: "Failed to mark all notifications read",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  // ============================================
  // ANALYTICS EXPORT
  // ============================================

  app.post("/api/communication-analytics/export", requireUser, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { type, format, patientId, startDate, endDate } = req.body;
      
      if (!type || !format) {
        return res.status(400).json({
          error: "Export type and format are required",
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      const validTypes = ["sentiment_trends", "engagement_metrics", "alerts", "patient_summary", "full_analytics"];
      const validFormats = ["csv", "json", "pdf"];
      
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid export type. Valid types: ${validTypes.join(", ")}`,
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          error: `Invalid format. Valid formats: ${validFormats.join(", ")}`,
          disclaimer: NO_CDS_DISCLAIMER
        });
      }
      
      logHipaaAudit("EXPORT_ANALYTICS_REQUEST", userId, patientId, `Type: ${type}, Format: ${format}`);
      
      const result = exportAnalyticsData(userId, type, format, { patientId, startDate, endDate });
      res.json(result);
    } catch (error) {
      console.error("[CommAnalytics] Error exporting analytics:", error);
      res.status(500).json({
        error: "Failed to export analytics",
        disclaimer: NO_CDS_DISCLAIMER
      });
    }
  });

  console.log("[CommAnalyticsRoutes] Routes module loaded with NO-CDS compliance");
  console.log("[CommAnalyticsRoutes] Enhanced: Trend Detection, Portal Tracking, Automated Alerts, Response Templates, Care Team Notifications, Export");
}
