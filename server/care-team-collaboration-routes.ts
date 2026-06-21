import { Router, Request, Response } from "express";
import {
  getPatientConversations,
  getConversation,
  getConversationMessages,
  createConversation,
  sendChatMessage,
  markMessagesRead,
  getPatientTasks,
  getTask,
  createTask,
  updateTaskStatus,
  addTaskComment,
  updateChecklistItem,
  getPatientReportReviews,
  getReportReview,
  createReportReview,
  addReportAnnotation,
  updateReviewerStatus,
  resolveAnnotation,
  finalizeReport,
  getAllConversations,
  getAllTasks,
  getAllReportReviews,
  NO_CDS_DISCLAIMER,
} from "./services/careTeamCollaborationService";

const router = Router();

const ROUTES_NO_CDS_DISCLAIMER = "DISCLAIMER: This collaboration feature is for care coordination and operational efficiency purposes only. It does not constitute clinical decision support and should not replace clinical judgment. All clinical decisions must be made by qualified healthcare professionals.";

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CareTeamCollab-Routes] ${action} by ${userId}: ${details}`);
}

router.get("/conversations", async (req: Request, res: Response) => {
  try {
    const { patientId, userId = "system" } = req.query;
    
    logHipaaAudit("CONVERSATIONS_ACCESS", userId as string, `Fetching conversations${patientId ? ` for patient ${patientId}` : ""}`);
    
    const conversations = patientId 
      ? getPatientConversations(patientId as string)
      : getAllConversations();
    
    res.json({
      success: true,
      conversations,
      count: conversations.length,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/conversations/:conversationId", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { userId = "system" } = req.query;
    
    logHipaaAudit("CONVERSATION_ACCESS", userId as string, `Fetching conversation ${conversationId}`);
    
    const conversation = getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    res.json({
      success: true,
      conversation,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.get("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { limit = "50", before, userId = "system" } = req.query;
    
    logHipaaAudit("MESSAGES_ACCESS", userId as string, `Fetching messages for conversation ${conversationId}`);
    
    const messages = getConversationMessages(conversationId, parseInt(limit as string), before as string);
    
    res.json({
      success: true,
      messages,
      count: messages.length,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/conversations", async (req: Request, res: Response) => {
  try {
    const { patientId, patientName, teamId, participants, userId = "system" } = req.body;
    
    if (!patientId || !patientName || !teamId || !participants) {
      return res.status(400).json({ error: "patientId, patientName, teamId, and participants are required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("CONVERSATION_CREATE", userId, `Creating conversation for patient ${patientId}`);
    
    const conversation = createConversation(patientId, patientName, teamId, participants, userId);
    
    res.json({
      success: true,
      conversation,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.post("/conversations/:conversationId/messages", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { senderId, senderName, senderRole, content, messageType = "text", mentionedUserIds = [], replyToId } = req.body;
    
    if (!senderId || !senderName || !senderRole || !content) {
      return res.status(400).json({ error: "senderId, senderName, senderRole, and content are required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("MESSAGE_SEND", senderId, `Sending message to conversation ${conversationId}`);
    
    const message = sendChatMessage(
      conversationId,
      senderId,
      senderName,
      senderRole,
      content,
      messageType,
      mentionedUserIds,
      replyToId
    );
    
    res.json({
      success: true,
      message,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/conversations/:conversationId/read", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId is required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("MESSAGES_READ", userId, `Marking messages as read in conversation ${conversationId}`);
    
    markMessagesRead(conversationId, userId);
    
    res.json({
      success: true,
      message: "Messages marked as read",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error marking messages read:", error);
    res.status(500).json({ error: "Failed to mark messages read" });
  }
});

router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const { patientId, userId = "system" } = req.query;
    
    logHipaaAudit("TASKS_ACCESS", userId as string, `Fetching tasks${patientId ? ` for patient ${patientId}` : ""}`);
    
    const tasks = patientId 
      ? getPatientTasks(patientId as string)
      : getAllTasks();
    
    const summary = {
      total: tasks.length,
      pending: tasks.filter(t => t.status === "pending").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      urgent: tasks.filter(t => t.priority === "urgent").length,
      overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== "completed").length,
    };
    
    res.json({
      success: true,
      tasks,
      summary,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.get("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userId = "system" } = req.query;
    
    logHipaaAudit("TASK_ACCESS", userId as string, `Fetching task ${taskId}`);
    
    const task = getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json({
      success: true,
      task,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      patientName,
      title,
      description,
      taskType,
      priority,
      assignedTo,
      createdBy,
      dueDate,
      checklistItems = [],
      tags = [],
    } = req.body;
    
    if (!patientId || !title || !taskType || !priority || !assignedTo || !createdBy || !dueDate) {
      return res.status(400).json({ error: "Required fields missing", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("TASK_CREATE", createdBy.userId, `Creating task "${title}" for patient ${patientId}`);
    
    const task = createTask(
      patientId,
      patientName || "Unknown Patient",
      title,
      description || "",
      taskType,
      priority,
      assignedTo,
      createdBy,
      dueDate,
      checklistItems,
      tags
    );
    
    res.json({
      success: true,
      task,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:taskId/status", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status, userId, userName } = req.body;
    
    if (!status || !userId || !userName) {
      return res.status(400).json({ error: "status, userId, and userName are required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("TASK_STATUS_UPDATE", userId, `Updating task ${taskId} status to ${status}`);
    
    const task = updateTaskStatus(taskId, status, userId, userName);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json({
      success: true,
      task,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error updating task status:", error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

router.post("/tasks/:taskId/comments", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { userId, userName, content } = req.body;
    
    if (!userId || !userName || !content) {
      return res.status(400).json({ error: "userId, userName, and content are required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("TASK_COMMENT", userId, `Adding comment to task ${taskId}`);
    
    const task = addTaskComment(taskId, userId, userName, content);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    res.json({
      success: true,
      task,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error adding task comment:", error);
    res.status(500).json({ error: "Failed to add task comment" });
  }
});

router.patch("/tasks/:taskId/checklist/:itemId", async (req: Request, res: Response) => {
  try {
    const { taskId, itemId } = req.params;
    const { isCompleted, userId } = req.body;
    
    if (isCompleted === undefined || !userId) {
      return res.status(400).json({ error: "isCompleted and userId are required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("CHECKLIST_UPDATE", userId, `Updating checklist item ${itemId} in task ${taskId}`);
    
    const task = updateChecklistItem(taskId, itemId, isCompleted, userId);
    if (!task) {
      return res.status(404).json({ error: "Task or checklist item not found" });
    }
    
    res.json({
      success: true,
      task,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error updating checklist item:", error);
    res.status(500).json({ error: "Failed to update checklist item" });
  }
});

router.get("/report-reviews", async (req: Request, res: Response) => {
  try {
    const { patientId, userId = "system" } = req.query;
    
    logHipaaAudit("REPORT_REVIEWS_ACCESS", userId as string, `Fetching report reviews${patientId ? ` for patient ${patientId}` : ""}`);
    
    const reviews = patientId 
      ? getPatientReportReviews(patientId as string)
      : getAllReportReviews();
    
    const summary = {
      total: reviews.length,
      draft: reviews.filter(r => r.status === "draft").length,
      underReview: reviews.filter(r => r.status === "under_review").length,
      approved: reviews.filter(r => r.status === "approved").length,
      finalized: reviews.filter(r => r.status === "finalized").length,
      requiresChanges: reviews.filter(r => r.status === "requires_changes").length,
    };
    
    res.json({
      success: true,
      reviews,
      summary,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching report reviews:", error);
    res.status(500).json({ error: "Failed to fetch report reviews" });
  }
});

router.get("/report-reviews/:reviewId", async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { userId = "system" } = req.query;
    
    logHipaaAudit("REPORT_REVIEW_ACCESS", userId as string, `Fetching report review ${reviewId}`);
    
    const review = getReportReview(reviewId);
    if (!review) {
      return res.status(404).json({ error: "Report review not found" });
    }
    
    res.json({
      success: true,
      review,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching report review:", error);
    res.status(500).json({ error: "Failed to fetch report review" });
  }
});

router.post("/report-reviews", async (req: Request, res: Response) => {
  try {
    const {
      patientId,
      patientName,
      reportType,
      reportTitle,
      reportContent,
      reviewers,
      creatorId,
      creatorName,
    } = req.body;
    
    if (!patientId || !reportType || !reportTitle || !reportContent || !reviewers || !creatorId || !creatorName) {
      return res.status(400).json({ error: "Required fields missing", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("REPORT_REVIEW_CREATE", creatorId, `Creating report review for patient ${patientId}`);
    
    const review = createReportReview(
      patientId,
      patientName || "Unknown Patient",
      reportType,
      reportTitle,
      reportContent,
      reviewers,
      creatorId,
      creatorName
    );
    
    res.json({
      success: true,
      review,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error creating report review:", error);
    res.status(500).json({ error: "Failed to create report review" });
  }
});

router.post("/report-reviews/:reviewId/annotations", async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const {
      userId,
      userName,
      userRole,
      sectionId,
      sectionTitle,
      comment,
      annotationType,
      highlightText,
    } = req.body;
    
    if (!userId || !userName || !userRole || !sectionId || !sectionTitle || !comment || !annotationType) {
      return res.status(400).json({ error: "Required fields missing", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("ANNOTATION_ADD", userId, `Adding annotation to report review ${reviewId}`);
    
    const review = addReportAnnotation(
      reviewId,
      userId,
      userName,
      userRole,
      sectionId,
      sectionTitle,
      comment,
      annotationType,
      highlightText
    );
    
    if (!review) {
      return res.status(404).json({ error: "Report review not found" });
    }
    
    res.json({
      success: true,
      review,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error adding annotation:", error);
    res.status(500).json({ error: "Failed to add annotation" });
  }
});

router.patch("/report-reviews/:reviewId/reviewers/:reviewerId", async (req: Request, res: Response) => {
  try {
    const { reviewId, reviewerId } = req.params;
    const { status, comments } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "status is required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("REVIEWER_STATUS", reviewerId, `Updating reviewer status for report ${reviewId}`);
    
    const review = updateReviewerStatus(reviewId, reviewerId, status, comments);
    if (!review) {
      return res.status(404).json({ error: "Report review or reviewer not found" });
    }
    
    res.json({
      success: true,
      review,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error updating reviewer status:", error);
    res.status(500).json({ error: "Failed to update reviewer status" });
  }
});

router.patch("/report-reviews/:reviewId/annotations/:annotationId/resolve", async (req: Request, res: Response) => {
  try {
    const { reviewId, annotationId } = req.params;
    const { userId, resolution } = req.body;
    
    if (!userId || !resolution) {
      return res.status(400).json({ error: "userId and resolution are required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("ANNOTATION_RESOLVE", userId, `Resolving annotation ${annotationId} in report ${reviewId}`);
    
    const review = resolveAnnotation(reviewId, annotationId, userId, resolution);
    if (!review) {
      return res.status(404).json({ error: "Report review or annotation not found" });
    }
    
    res.json({
      success: true,
      review,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error resolving annotation:", error);
    res.status(500).json({ error: "Failed to resolve annotation" });
  }
});

router.post("/report-reviews/:reviewId/finalize", async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { userId, userName } = req.body;
    
    if (!userId || !userName) {
      return res.status(400).json({ error: "userId and userName are required", disclaimer: ROUTES_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("REPORT_FINALIZE", userId, `Finalizing report review ${reviewId}`);
    
    const review = finalizeReport(reviewId, userId, userName);
    if (!review) {
      return res.status(404).json({ error: "Report review not found" });
    }
    
    res.json({
      success: true,
      review,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error finalizing report:", error);
    res.status(500).json({ error: "Failed to finalize report" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const { userId = "system" } = req.query;
    
    logHipaaAudit("DASHBOARD_ACCESS", userId as string, "Fetching collaboration dashboard");
    
    const conversations = getAllConversations();
    const tasks = getAllTasks();
    const reviews = getAllReportReviews();
    
    const dashboard = {
      conversations: {
        total: conversations.length,
        active: conversations.filter(c => c.isActive).length,
        withUnread: conversations.filter(c => Object.values(c.unreadCounts).some(count => count > 0)).length,
      },
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === "pending").length,
        inProgress: tasks.filter(t => t.status === "in_progress").length,
        completed: tasks.filter(t => t.status === "completed").length,
        urgent: tasks.filter(t => t.priority === "urgent").length,
        overdue: tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== "completed").length,
      },
      reportReviews: {
        total: reviews.length,
        pending: reviews.filter(r => r.status === "under_review").length,
        approved: reviews.filter(r => r.status === "approved").length,
        finalized: reviews.filter(r => r.status === "finalized").length,
        openAnnotations: reviews.reduce((sum, r) => sum + r.annotations.filter(a => a.status === "open").length, 0),
      },
      recentActivity: [
        ...tasks.slice(0, 3).map(t => ({
          type: "task" as const,
          title: t.title,
          patient: t.patientName,
          status: t.status,
          timestamp: t.updatedAt,
        })),
        ...conversations.slice(0, 3).map(c => ({
          type: "message" as const,
          title: c.lastMessagePreview,
          patient: c.patientName,
          timestamp: c.lastMessageAt,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5),
    };
    
    res.json({
      success: true,
      dashboard,
      generatedAt: new Date().toISOString(),
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// ==================== AI-POWERED CARE TEAM COLLABORATION ====================

const AI_COLLAB_NO_CDS_DISCLAIMER = "DISCLAIMER: These AI-generated summaries, suggestions, and drafts are for care coordination efficiency only. They do NOT constitute clinical decision support and should NOT replace clinical judgment. All clinical decisions must be made by qualified healthcare professionals. Review and verify all AI outputs before use.";

router.post("/ai/summarize-thread", async (req: Request, res: Response) => {
  try {
    const { conversationId, userId = "system" } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required", disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("AI_THREAD_SUMMARY", userId, `Generating AI summary for conversation ${conversationId}`);
    
    const conversation = getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    
    const messages = getConversationMessages(conversationId, 50);
    
    let summary: {
      overallSummary: string;
      keyTopics: string[];
      actionItems: Array<{ description: string; suggestedAssignee?: string; priority: string }>;
      participantContributions: Array<{ name: string; role: string; messageCount: number; keyPoints: string[] }>;
      pendingQuestions: string[];
      timeline: Array<{ timestamp: string; event: string }>;
    } | null = null;
    
    try {
      const openai = new (await import("openai")).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && messages.length > 0) {
        const messageText = messages.map(m => `[${m.senderName} (${m.senderRole})] ${m.content}`).join("\n");
        
        const prompt = `Analyze this care team conversation about patient "${conversation.patientName}" and provide a comprehensive summary.

Messages:
${messageText}

Provide JSON with:
{
  "overallSummary": "2-3 sentence overview of the discussion",
  "keyTopics": ["List of main topics discussed"],
  "actionItems": [{"description": "action needed", "suggestedAssignee": "role or name if mentioned", "priority": "high/medium/low"}],
  "participantContributions": [{"name": "person name", "role": "their role", "messageCount": N, "keyPoints": ["main points they made"]}],
  "pendingQuestions": ["Any unanswered questions from the conversation"],
  "timeline": [{"timestamp": "relative time", "event": "key event"}]
}

Focus on care coordination - do NOT provide clinical advice. Extract action items and communication gaps.`;
        
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 800,
        });
        
        summary = JSON.parse(response.choices[0]?.message?.content || "null");
      }
    } catch (error) {
      console.log("[CareTeamCollab] AI summary unavailable, using fallback");
    }
    
    // Fallback summary
    if (!summary) {
      const participantStats = new Map<string, { name: string; role: string; count: number; contents: string[] }>();
      messages.forEach(m => {
        if (!participantStats.has(m.senderId)) {
          participantStats.set(m.senderId, { name: m.senderName, role: m.senderRole, count: 0, contents: [] });
        }
        const stats = participantStats.get(m.senderId)!;
        stats.count++;
        stats.contents.push(m.content);
      });
      
      summary = {
        overallSummary: `Care team discussion with ${participantStats.size} participants about ${conversation.patientName}. ${messages.length} messages exchanged covering patient care coordination.`,
        keyTopics: ["Patient status update", "Care coordination", "Team communication"],
        actionItems: messages.filter(m => m.content.includes("@") || m.content.toLowerCase().includes("please") || m.content.toLowerCase().includes("need"))
          .slice(0, 3)
          .map(m => ({ description: m.content.slice(0, 100), suggestedAssignee: undefined, priority: "medium" })),
        participantContributions: Array.from(participantStats.values()).map(p => ({
          name: p.name,
          role: p.role,
          messageCount: p.count,
          keyPoints: p.contents.slice(0, 2).map(c => c.slice(0, 50) + "..."),
        })),
        pendingQuestions: messages.filter(m => m.content.includes("?")).slice(-3).map(m => m.content.slice(0, 100)),
        timeline: messages.slice(0, 5).map(m => ({ timestamp: new Date(m.createdAt).toLocaleString(), event: m.content.slice(0, 50) })),
      };
    }
    
    res.json({
      success: true,
      conversationId,
      patientName: conversation.patientName,
      messageCount: messages.length,
      summary,
      generatedAt: new Date().toISOString(),
      disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error generating thread summary:", error);
    res.status(500).json({ error: "Failed to generate thread summary" });
  }
});

router.post("/ai/suggest-relevant-info", async (req: Request, res: Response) => {
  try {
    const { patientId, userId = "system", context = "general" } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "patientId is required", disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("AI_RELEVANT_INFO", userId, `Generating relevant info suggestions for patient ${patientId}`);
    
    // Gather context from conversations, tasks, and reports
    const conversations = getPatientConversations(patientId);
    const tasks = getPatientTasks(patientId);
    const reviews = getPatientReportReviews(patientId);
    
    let suggestions: {
      priorityItems: Array<{ type: string; title: string; reason: string; urgency: string }>;
      recentUpdates: Array<{ source: string; summary: string; timestamp: string }>;
      suggestedReviews: Array<{ item: string; rationale: string }>;
      communicationGaps: Array<{ description: string; suggestion: string }>;
      upcomingDeadlines: Array<{ task: string; dueDate: string; status: string }>;
    } | null = null;
    
    try {
      const openai = new (await import("openai")).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        const contextData = {
          conversations: conversations.slice(0, 3).map(c => ({ preview: c.lastMessagePreview, participants: c.participants.length })),
          tasks: tasks.slice(0, 5).map(t => ({ title: t.title, status: t.status, priority: t.priority, due: t.dueDate })),
          reviews: reviews.slice(0, 3).map(r => ({ title: r.reportTitle, status: r.status, openAnnotations: r.annotations.filter(a => a.status === "open").length })),
        };
        
        const prompt = `Analyze this patient's care coordination data and suggest relevant information for the care team to review.

Context:
${JSON.stringify(contextData, null, 2)}

Provide JSON with:
{
  "priorityItems": [{"type": "task/message/report", "title": "item title", "reason": "why it's priority", "urgency": "high/medium/low"}],
  "recentUpdates": [{"source": "where from", "summary": "brief summary", "timestamp": "when"}],
  "suggestedReviews": [{"item": "what to review", "rationale": "why review it"}],
  "communicationGaps": [{"description": "gap identified", "suggestion": "how to address"}],
  "upcomingDeadlines": [{"task": "task name", "dueDate": "date", "status": "current status"}]
}

Focus on coordination gaps and priority items - NO clinical advice.`;
        
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 600,
        });
        
        suggestions = JSON.parse(response.choices[0]?.message?.content || "null");
      }
    } catch (error) {
      console.log("[CareTeamCollab] AI suggestions unavailable, using fallback");
    }
    
    // Fallback suggestions
    if (!suggestions) {
      const urgentTasks = tasks.filter(t => t.priority === "urgent" && t.status !== "completed");
      const overdueTasks = tasks.filter(t => new Date(t.dueDate) < new Date() && t.status !== "completed");
      const openAnnotations = reviews.flatMap(r => r.annotations.filter(a => a.status === "open"));
      
      suggestions = {
        priorityItems: [
          ...urgentTasks.map(t => ({ type: "task", title: t.title, reason: "Marked as urgent", urgency: "high" })),
          ...overdueTasks.map(t => ({ type: "task", title: t.title, reason: "Past due date", urgency: "high" })),
        ].slice(0, 5),
        recentUpdates: conversations.slice(0, 3).map(c => ({
          source: "Team discussion",
          summary: c.lastMessagePreview,
          timestamp: c.lastMessageAt,
        })),
        suggestedReviews: reviews.filter(r => r.status === "under_review").map(r => ({
          item: r.reportTitle,
          rationale: `Report awaiting review with ${r.annotations.filter(a => a.status === "open").length} open annotations`,
        })),
        communicationGaps: openAnnotations.length > 3 ? [{
          description: `${openAnnotations.length} unresolved annotations across reports`,
          suggestion: "Schedule team review to address outstanding items",
        }] : [],
        upcomingDeadlines: tasks.filter(t => t.status !== "completed").slice(0, 5).map(t => ({
          task: t.title,
          dueDate: t.dueDate,
          status: t.status,
        })),
      };
    }
    
    res.json({
      success: true,
      patientId,
      suggestions,
      dataContext: {
        conversationsCount: conversations.length,
        tasksCount: tasks.length,
        reviewsCount: reviews.length,
      },
      generatedAt: new Date().toISOString(),
      disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error generating suggestions:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

router.post("/ai/draft-follow-up", async (req: Request, res: Response) => {
  try {
    const { 
      patientId, 
      userId = "system",
      draftType = "message", // "message" | "task"
      context, // recent event or interaction that triggered the draft
      targetRole, // who the message/task should be for
    } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "patientId is required", disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("AI_DRAFT_FOLLOW_UP", userId, `Generating ${draftType} draft for patient ${patientId}`);
    
    // Get recent activity for context
    const conversations = getPatientConversations(patientId);
    const tasks = getPatientTasks(patientId);
    const recentMessages = conversations.length > 0 ? getConversationMessages(conversations[0].id, 10) : [];
    
    let draft: {
      type: string;
      suggestedContent: string;
      suggestedTitle?: string;
      suggestedAssignees?: string[];
      suggestedPriority?: string;
      suggestedDueDate?: string;
      rationale: string;
      alternatives: Array<{ content: string; reason: string }>;
    } | null = null;
    
    try {
      const openai = new (await import("openai")).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        const contextData = {
          recentMessages: recentMessages.slice(0, 5).map(m => `${m.senderName}: ${m.content}`),
          pendingTasks: tasks.filter(t => t.status !== "completed").map(t => t.title),
          context,
          targetRole,
          draftType,
        };
        
        const prompt = `Generate a professional ${draftType === "task" ? "task assignment" : "follow-up message"} for care team coordination.

Context:
${JSON.stringify(contextData, null, 2)}

${draftType === "task" ? `Create a task with:
{
  "type": "task",
  "suggestedTitle": "Clear task title",
  "suggestedContent": "Detailed task description",
  "suggestedAssignees": ["roles that should handle this"],
  "suggestedPriority": "urgent/high/normal/low",
  "suggestedDueDate": "suggested timeframe",
  "rationale": "why this task is needed",
  "alternatives": [{"content": "alternative approach", "reason": "when to use this"}]
}` : `Create a message with:
{
  "type": "message",
  "suggestedContent": "Professional follow-up message",
  "rationale": "why this message is needed",
  "alternatives": [{"content": "alternative message", "reason": "when to use this"}]
}`}

Keep it professional and coordination-focused. NO clinical advice or recommendations.`;
        
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 500,
        });
        
        draft = JSON.parse(response.choices[0]?.message?.content || "null");
      }
    } catch (error) {
      console.log("[CareTeamCollab] AI draft unavailable, using fallback");
    }
    
    // Fallback draft
    if (!draft) {
      if (draftType === "task") {
        draft = {
          type: "task",
          suggestedTitle: `Follow-up for patient care coordination`,
          suggestedContent: `${context || "Please review and follow up on recent patient updates."}`,
          suggestedAssignees: targetRole ? [targetRole] : ["care_coordinator"],
          suggestedPriority: "normal",
          suggestedDueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          rationale: "Based on recent activity, a follow-up task may help ensure continuity of care coordination.",
          alternatives: [{
            content: "Schedule team huddle to discuss patient status",
            reason: "If multiple team members need to be involved",
          }],
        };
      } else {
        draft = {
          type: "message",
          suggestedContent: `Hi team, following up on ${context || "recent patient updates"}. Please review and let me know if any action is needed.`,
          rationale: "Follow-up message to ensure team awareness and coordination.",
          alternatives: [{
            content: "Requesting status update on pending items for this patient.",
            reason: "If specific updates are needed",
          }],
        };
      }
    }
    
    res.json({
      success: true,
      patientId,
      draft,
      recentActivityContext: {
        conversationsCount: conversations.length,
        recentMessagesCount: recentMessages.length,
        pendingTasksCount: tasks.filter(t => t.status !== "completed").length,
      },
      generatedAt: new Date().toISOString(),
      disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER,
      importantNote: "This is a draft suggestion only. Review and modify as needed before sending.",
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error generating draft:", error);
    res.status(500).json({ error: "Failed to generate draft" });
  }
});

router.post("/ai/analyze-clinical-event", async (req: Request, res: Response) => {
  try {
    const { 
      patientId, 
      userId = "system",
      eventType, // "lab_result" | "medication_change" | "appointment" | "vital_alert" | "custom"
      eventDescription,
      eventData,
    } = req.body;
    
    if (!patientId || !eventType || !eventDescription) {
      return res.status(400).json({ error: "patientId, eventType, and eventDescription are required", disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER });
    }
    
    logHipaaAudit("AI_CLINICAL_EVENT_ANALYSIS", userId, `Analyzing ${eventType} event for patient ${patientId}`);
    
    let analysis: {
      eventSummary: string;
      suggestedActions: Array<{ action: string; assignTo: string; priority: string; rationale: string }>;
      communicationNeeds: Array<{ who: string; what: string; urgency: string }>;
      documentationNeeds: string[];
      relatedTasks: string[];
    } | null = null;
    
    try {
      const openai = new (await import("openai")).default({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      
      if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
        const prompt = `Analyze this clinical event and suggest coordination actions for the care team.

Event Type: ${eventType}
Description: ${eventDescription}
${eventData ? `Additional Data: ${JSON.stringify(eventData)}` : ""}

Provide JSON with:
{
  "eventSummary": "Brief summary of the event",
  "suggestedActions": [{"action": "what to do", "assignTo": "role", "priority": "high/medium/low", "rationale": "why"}],
  "communicationNeeds": [{"who": "role/person", "what": "information to share", "urgency": "immediate/soon/routine"}],
  "documentationNeeds": ["Items that should be documented"],
  "relatedTasks": ["Existing tasks that may be affected"]
}

Focus on COORDINATION actions only - NOT clinical decisions. Suggest who should be informed and what tasks to create.`;
        
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          max_completion_tokens: 500,
        });
        
        analysis = JSON.parse(response.choices[0]?.message?.content || "null");
      }
    } catch (error) {
      console.log("[CareTeamCollab] AI event analysis unavailable, using fallback");
    }
    
    // Fallback analysis
    if (!analysis) {
      const urgencyMap: Record<string, string> = {
        vital_alert: "immediate",
        lab_result: "soon",
        medication_change: "soon",
        appointment: "routine",
        custom: "routine",
      };
      
      analysis = {
        eventSummary: `${eventType.replace(/_/g, " ")} event: ${eventDescription}`,
        suggestedActions: [{
          action: "Review event details and determine appropriate follow-up",
          assignTo: "care_coordinator",
          priority: urgencyMap[eventType] === "immediate" ? "high" : "medium",
          rationale: "Ensure timely response to patient event",
        }],
        communicationNeeds: [{
          who: "primary_physician",
          what: `Notify of ${eventType.replace(/_/g, " ")}`,
          urgency: urgencyMap[eventType] || "routine",
        }],
        documentationNeeds: ["Record event in patient chart", "Update care team on actions taken"],
        relatedTasks: [],
      };
    }
    
    res.json({
      success: true,
      patientId,
      eventType,
      analysis,
      generatedAt: new Date().toISOString(),
      disclaimer: AI_COLLAB_NO_CDS_DISCLAIMER,
      importantNote: "These are coordination suggestions only. All clinical decisions must be made by qualified healthcare professionals.",
    });
  } catch (error) {
    console.error("[CareTeamCollab] Error analyzing clinical event:", error);
    res.status(500).json({ error: "Failed to analyze clinical event" });
  }
});

export default router;

console.log("[CareTeamCollaboration] Routes module loaded");
console.log("[CareTeamCollaboration] AI-powered features: thread summarization, relevant info suggestions, draft generation, clinical event analysis");
