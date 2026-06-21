import { Router, Request, Response } from "express";
import { aiHealthAssistant, HealthContext, AppointmentRequest } from "./services/ai-health-assistant";
import { storage } from "./storage";
import { logPhiAccess } from "./security/hipaa-audit";
import { insertAssistantInsightSchema } from "@shared/schema";

function auditAccess(userId: string, patientId: string, resourceType: string, details: string) {
  logPhiAccess({
    userId,
    patientId,
    resourceType,
    action: "read",
    details,
  });
}

const router = Router();

router.get("/api/health-assistant/context-options", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";
    const patientId = profileId || userId;

    auditAccess(userId, patientId, "ContextOptions", "Loading available context items for granular selection");

    const options: {
      labResults: Array<{ id: string; label: string; value: string; unit: string; date: string; flag?: string }>;
      conditions: Array<{ id: string; label: string; type: string; date: string }>;
      medications: Array<{ id: string; label: string; dosage: string; frequency: string }>;
      vitals: Array<{ id: string; label: string; type: string; value: string; date: string }>;
      documents: Array<{ id: string; label: string; type: string; date: string }>;
    } = { labResults: [], conditions: [], medications: [], vitals: [], documents: [] };

    try {
      const labs = await storage.getLabResultsByPatient(patientId);
      options.labResults = labs.slice(0, 50).map((l: any) => ({
        id: l.id?.toString() || `lab-${l.testName}-${l.date}`,
        label: l.testName || l.name || "Lab Test",
        value: l.value?.toString() || "",
        unit: l.unit || "",
        date: l.date || l.collectedAt || l.createdAt || "",
        flag: l.flag || l.status || undefined,
      }));
    } catch {}

    try {
      const conditions = await storage.getConditionSpecificPROMs(patientId);
      options.conditions = conditions.slice(0, 50).map((c: any) => ({
        id: c.id?.toString() || `cond-${c.conditionType}`,
        label: c.conditionType || c.name || "Condition",
        type: c.conditionType || "condition",
        date: c.createdAt || c.diagnosedDate || "",
      }));
    } catch {}

    try {
      const medications = await storage.getMedicationsByPatient(patientId);
      options.medications = medications.slice(0, 50).map((m: any) => ({
        id: m.id?.toString() || `med-${m.name}`,
        label: m.name || m.medicationName || "Medication",
        dosage: m.dosage || m.dose || "",
        frequency: m.frequency || m.schedule || "",
      }));
    } catch {}

    try {
      const vitals = await storage.getVitalsByPatient(patientId);
      options.vitals = vitals.slice(0, 50).map((v: any) => ({
        id: v.id?.toString() || `vital-${v.type}-${v.date}`,
        label: v.type || v.vitalType || "Vital",
        type: v.type || v.vitalType || "vital",
        value: v.value?.toString() || "",
        date: v.date || v.measuredAt || v.createdAt || "",
      }));
    } catch {}

    try {
      const documents = await storage.getDocumentInsightsByPatient(patientId);
      options.documents = documents.slice(0, 30).map((d: any) => ({
        id: d.id?.toString() || d.documentId || `doc-${d.title}`,
        label: d.title || d.name || "Document",
        type: d.documentType || d.type || "Document",
        date: d.createdAt || d.date || "",
      }));
    } catch {}

    res.json({ options });
  } catch (error) {
    console.error("[HealthAssistant] Context options error:", error);
    res.status(500).json({ error: "Failed to load context options" });
  }
});

router.post("/api/health-assistant/chat", async (req: Request, res: Response) => {
  try {
    const { message, profileId, contextSelection } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    let healthContext: HealthContext;
    let isGranular = false;

    if (contextSelection && !contextSelection.useFullContext) {
      healthContext = await buildGranularContext(userId, profileId || userId, contextSelection);
      isGranular = true;
      auditAccess(userId, profileId || userId, "GranularContext", `Granular context selection: labs=${contextSelection.labResultIds?.length || 0}, conditions=${contextSelection.conditionIds?.length || 0}, meds=${contextSelection.medicationIds?.length || 0}, vitals=${contextSelection.vitalIds?.length || 0}, docs=${contextSelection.documentIds?.length || 0}, timeRange=${contextSelection.timeRange?.start || "none"}-${contextSelection.timeRange?.end || "none"}`);
    } else {
      healthContext = await buildHealthContext(userId, profileId);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await aiHealthAssistant.chat(userId, profileId || "default", message, healthContext, isGranular);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("[HealthAssistant] Chat error:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

router.post("/api/health-assistant/summarize", async (req: Request, res: Response) => {
  try {
    const { documentId, documentContent, documentType, profileId } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!documentContent && !documentId) {
      return res.status(400).json({ error: "Document content or ID is required" });
    }

    let content = documentContent;
    let type = documentType || "Medical Document";

    if (documentId && !documentContent) {
      auditAccess(userId, profileId || "default", "DocumentInsight", `Reading document ${documentId} for summarization`);
      const doc = await storage.getDocumentInsights(documentId);
      if (doc) {
        content = (doc as any).content || (doc as any).summary || "Document content not available";
        type = (doc as any).documentType || (doc as any).type || "Medical Document";
      }
    }

    const summary = await aiHealthAssistant.summarizeDocument(
      userId,
      profileId || "default",
      content,
      type
    );

    res.json({ summary });
  } catch (error) {
    console.error("[HealthAssistant] Summarize error:", error);
    res.status(500).json({ error: "Failed to summarize document" });
  }
});

router.get("/api/health-assistant/reminders", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const healthContext = await buildHealthContext(userId, profileId);
    const reminders = await aiHealthAssistant.getProactiveReminders(
      userId,
      profileId || "default",
      healthContext
    );

    res.json({ reminders });
  } catch (error) {
    console.error("[HealthAssistant] Reminders error:", error);
    res.status(500).json({ error: "Failed to get reminders" });
  }
});

router.get("/api/health-assistant/summary", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const healthContext = await buildHealthContext(userId, profileId);
    const summary = await aiHealthAssistant.getHealthSummary(
      userId,
      profileId || "default",
      healthContext
    );

    res.json({ summary });
  } catch (error) {
    console.error("[HealthAssistant] Summary error:", error);
    res.status(500).json({ error: "Failed to get health summary" });
  }
});

router.post("/api/health-assistant/clear", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    aiHealthAssistant.clearConversation(userId, profileId || "default");

    res.json({ success: true });
  } catch (error) {
    console.error("[HealthAssistant] Clear error:", error);
    res.status(500).json({ error: "Failed to clear conversation" });
  }
});

router.get("/api/health-assistant/medication-reminders", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const healthContext = await buildHealthContext(userId, profileId);
    const reminders = await aiHealthAssistant.getMedicationReminders(
      userId,
      profileId || "default",
      healthContext
    );

    res.json({ 
      reminders,
      noCdsDisclaimer: "Medication reminders are for informational purposes only. Always follow your healthcare provider's instructions for taking medications."
    });
  } catch (error) {
    console.error("[HealthAssistant] Medication reminders error:", error);
    res.status(500).json({ error: "Failed to get medication reminders" });
  }
});

router.get("/api/health-assistant/appointment-slots", async (req: Request, res: Response) => {
  try {
    const { profileId, specialty, provider, startDate, endDate } = req.query;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const slots = await aiHealthAssistant.getAvailableAppointmentSlots(
      userId,
      (profileId as string) || "default",
      {
        specialty: specialty as string,
        provider: provider as string,
        startDate: startDate as string,
        endDate: endDate as string,
      }
    );

    res.json({ slots });
  } catch (error) {
    console.error("[HealthAssistant] Appointment slots error:", error);
    res.status(500).json({ error: "Failed to get appointment slots" });
  }
});

router.post("/api/health-assistant/appointments", async (req: Request, res: Response) => {
  try {
    const { profileId, ...request } = req.body as AppointmentRequest & { profileId?: string };
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const result = await aiHealthAssistant.processAppointmentRequest(
      userId,
      profileId || "default",
      request
    );

    res.json(result);
  } catch (error) {
    console.error("[HealthAssistant] Appointment request error:", error);
    res.status(500).json({ error: "Failed to process appointment request" });
  }
});

router.get("/api/health-assistant/visit-guidance", async (req: Request, res: Response) => {
  try {
    const { profileId, appointmentId, phase } = req.query;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!appointmentId || !phase) {
      return res.status(400).json({ error: "appointmentId and phase are required" });
    }

    const healthContext = await buildHealthContext(userId, profileId as string);
    const guidance = await aiHealthAssistant.generateVisitGuidance(
      userId,
      (profileId as string) || "default",
      appointmentId as string,
      phase as "pre_visit" | "post_visit",
      healthContext
    );

    res.json({ guidance });
  } catch (error) {
    console.error("[HealthAssistant] Visit guidance error:", error);
    res.status(500).json({ error: "Failed to get visit guidance" });
  }
});

router.post("/api/health-assistant/ask", async (req: Request, res: Response) => {
  try {
    const { profileId, question } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const healthContext = await buildHealthContext(userId, profileId);
    const answer = await aiHealthAssistant.answerHealthQuestion(
      userId,
      profileId || "default",
      question,
      healthContext
    );

    res.json(answer);
  } catch (error) {
    console.error("[HealthAssistant] Ask question error:", error);
    res.status(500).json({ error: "Failed to answer question" });
  }
});

router.get("/api/health-assistant/quick-actions", async (req: Request, res: Response) => {
  try {
    const profileId = req.query.profileId as string;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const healthContext = await buildHealthContext(userId, profileId);
    
    const quickActions = [
      {
        id: "schedule-appointment",
        title: "Schedule Appointment",
        description: "Book a new appointment with your provider",
        icon: "calendar",
        action: "schedule",
      },
      {
        id: "medication-reminder",
        title: "Medication Reminders",
        description: "View and manage your medication schedule",
        icon: "pill",
        action: "medications",
      },
      {
        id: "pre-visit-prep",
        title: "Prepare for Visit",
        description: "Get ready for your upcoming appointment",
        icon: "clipboard",
        action: "pre_visit",
      },
      {
        id: "post-visit-care",
        title: "Post-Visit Care",
        description: "Review care instructions after your visit",
        icon: "heart",
        action: "post_visit",
      },
      {
        id: "ask-question",
        title: "Ask a Question",
        description: "Get answers to common health questions",
        icon: "help",
        action: "ask",
      },
      {
        id: "view-records",
        title: "My Records",
        description: "Access your health records and documents",
        icon: "folder",
        action: "records",
      },
    ];

    const upcomingCount = healthContext.upcomingAppointments?.length || 0;
    const medicationCount = healthContext.medications?.length || 0;

    res.json({ 
      quickActions,
      stats: {
        upcomingAppointments: upcomingCount,
        activeMedications: medicationCount,
        documentsToReview: healthContext.recentDocuments?.length || 0,
      }
    });
  } catch (error) {
    console.error("[HealthAssistant] Quick actions error:", error);
    res.status(500).json({ error: "Failed to get quick actions" });
  }
});

// ============================================
// CONVERSATION HISTORY & TIMELINE
// ============================================

router.get("/api/health-assistant/history", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const conversations = await storage.getAssistantConversations(userId);
    const active = conversations.filter(c => !c.mergedInto);

    res.json({ conversations: active });
  } catch (error) {
    console.error("[HealthAssistant] History error:", error);
    res.status(500).json({ error: "Failed to get conversation history" });
  }
});

router.get("/api/health-assistant/history/:conversationId", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const conversation = await storage.getAssistantConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const messages = await storage.getAssistantMessages(conversationId);

    res.json({ conversation, messages });
  } catch (error) {
    console.error("[HealthAssistant] Conversation detail error:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.post("/api/health-assistant/persist", async (req: Request, res: Response) => {
  try {
    const { profileId, userMessage, assistantResponse, conversationId } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!userMessage || !assistantResponse) {
      return res.status(400).json({ error: "userMessage and assistantResponse are required" });
    }

    const result = await aiHealthAssistant.persistChat(
      userId,
      profileId || "default",
      userMessage,
      assistantResponse,
      conversationId
    );

    res.json(result);
  } catch (error) {
    console.error("[HealthAssistant] Persist error:", error);
    res.status(500).json({ error: "Failed to persist conversation" });
  }
});

// ============================================
// AI SUMMARIZATION
// ============================================

router.post("/api/health-assistant/history/:conversationId/summarize", async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const insight = await aiHealthAssistant.summarizeConversation(userId, conversationId);

    res.json({ insight });
  } catch (error: any) {
    console.error("[HealthAssistant] Summarize conversation error:", error);
    res.status(500).json({ error: error.message || "Failed to summarize conversation" });
  }
});

router.post("/api/health-assistant/summarize-period", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    const insight = await aiHealthAssistant.summarizePeriod(userId, startDate, endDate);

    res.json({ insight });
  } catch (error: any) {
    console.error("[HealthAssistant] Period summary error:", error);
    res.status(500).json({ error: error.message || "Failed to generate period summary" });
  }
});

router.get("/api/health-assistant/insights", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const insights = await storage.getAssistantInsights(userId);

    res.json({ insights });
  } catch (error) {
    console.error("[HealthAssistant] Insights error:", error);
    res.status(500).json({ error: "Failed to get insights" });
  }
});

router.delete("/api/health-assistant/insights/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    await storage.deleteAssistantInsight(id, userId);

    res.json({ success: true });
  } catch (error) {
    console.error("[HealthAssistant] Delete insight error:", error);
    res.status(500).json({ error: "Failed to delete insight" });
  }
});

// ============================================
// DEDUPLICATION & MERGE
// ============================================

router.get("/api/health-assistant/duplicates", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    const duplicates = await aiHealthAssistant.findDuplicateConversations(userId);

    res.json({ duplicates });
  } catch (error) {
    console.error("[HealthAssistant] Duplicates error:", error);
    res.status(500).json({ error: "Failed to find duplicates" });
  }
});

router.post("/api/health-assistant/merge", async (req: Request, res: Response) => {
  try {
    const { targetId, sourceIds } = req.body;
    const user = req.user as any;
    const userId = user?.claims?.sub || "current-user";

    if (!targetId || !sourceIds || !Array.isArray(sourceIds) || sourceIds.length === 0) {
      return res.status(400).json({ error: "targetId and sourceIds array are required" });
    }

    const merged = await aiHealthAssistant.mergeConversations(userId, targetId, sourceIds);

    if (!merged) {
      return res.status(404).json({ error: "Target conversation not found" });
    }

    res.json({ conversation: merged });
  } catch (error) {
    console.error("[HealthAssistant] Merge error:", error);
    res.status(500).json({ error: "Failed to merge conversations" });
  }
});

async function buildHealthContext(userId: string, profileId?: string): Promise<HealthContext> {
  const patientId = profileId || userId;
  
  try {
    const context: HealthContext = {};

    try {
      auditAccess(userId, patientId, "Medication", "Loading medications for health assistant context");
      const medications = await storage.getMedicationsByPatient(patientId);
      if (medications && medications.length > 0) {
        context.medications = medications.slice(0, 10).map((m: any) => ({
          name: m.name || m.medicationName || "Unknown",
          dosage: m.dosage || m.dose || "",
          frequency: m.frequency || m.schedule || "",
        }));
      }
    } catch (e) {}

    try {
      auditAccess(userId, patientId, "Appointment", "Loading appointments for health assistant context");
      const allAppointments = await storage.getAppointments();
      if (allAppointments && allAppointments.length > 0) {
        const patientAppointments = allAppointments.filter((a: any) => 
          a.patientId === patientId || a.userId === userId
        );
        const upcoming = patientAppointments
          .filter((a: any) => new Date(a.scheduledAt || a.date) >= new Date())
          .slice(0, 5);
        context.upcomingAppointments = upcoming.map((a: any) => ({
          provider: a.provider || "Provider",
          date: a.scheduledAt || a.date || new Date().toISOString(),
          type: a.type || "Appointment",
        }));
      }
    } catch (e) {}

    try {
      auditAccess(userId, patientId, "Document", "Loading documents for health assistant context");
      const documents = await storage.getDocumentInsightsByPatient(patientId);
      if (documents && documents.length > 0) {
        context.recentDocuments = documents.slice(0, 5).map((d: any) => ({
          title: d.title || d.name || d.documentId || "Document",
          type: d.documentType || d.type || "Document",
          date: d.createdAt || d.date || new Date().toISOString(),
        }));
      }
    } catch (e) {}

    try {
      auditAccess(userId, patientId, "Condition", "Loading conditions for health assistant context");
      const proms = await storage.getConditionSpecificPROMs(patientId);
      if (proms && proms.length > 0) {
        context.conditions = proms.slice(0, 10).map((p: any) => ({
          name: p.conditionType || p.name || "Condition",
          diagnosedDate: p.createdAt || "",
        }));
      }
    } catch (e) {}

    return context;
  } catch (error) {
    console.error("[HealthAssistant] Error building context:", error);
    return {};
  }
}

interface ContextSelection {
  useFullContext?: boolean;
  labResultIds?: string[];
  conditionIds?: string[];
  medicationIds?: string[];
  vitalIds?: string[];
  documentIds?: string[];
  categories?: string[];
  timeRange?: { start: string; end: string };
}

async function buildGranularContext(userId: string, patientId: string, selection: ContextSelection): Promise<HealthContext> {
  const context: HealthContext = {};
  const timeStart = selection.timeRange?.start ? new Date(selection.timeRange.start) : null;
  const timeEnd = selection.timeRange?.end ? new Date(selection.timeRange.end) : null;

  function inTimeRange(dateStr: string | undefined): boolean {
    if (!dateStr || (!timeStart && !timeEnd)) return true;
    const d = new Date(dateStr);
    if (timeStart && d < timeStart) return false;
    if (timeEnd && d > timeEnd) return false;
    return true;
  }

  const wantLabs = selection.categories?.includes("labResults") || (selection.labResultIds && selection.labResultIds.length > 0);
  const wantConditions = selection.categories?.includes("conditions") || (selection.conditionIds && selection.conditionIds.length > 0);
  const wantMeds = selection.categories?.includes("medications") || (selection.medicationIds && selection.medicationIds.length > 0);
  const wantVitals = selection.categories?.includes("vitals") || (selection.vitalIds && selection.vitalIds.length > 0);
  const wantDocs = selection.categories?.includes("documents") || (selection.documentIds && selection.documentIds.length > 0);

  if (wantLabs) {
    try {
      auditAccess(userId, patientId, "LabResult", `Granular context: loading labs (ids: ${selection.labResultIds?.join(",") || "all in category"})`);
      const labs = await storage.getLabResultsByPatient(patientId);
      let filtered = labs;
      if (selection.labResultIds && selection.labResultIds.length > 0) {
        const idSet = new Set(selection.labResultIds);
        filtered = labs.filter((l: any) => idSet.has(l.id?.toString()) || idSet.has(`lab-${l.testName}-${l.date}`));
      }
      filtered = filtered.filter((l: any) => inTimeRange(l.date || l.collectedAt || l.createdAt));
      context.labResults = filtered.slice(0, 20).map((l: any) => ({
        name: l.testName || l.name || "Lab Test",
        value: l.value?.toString() || "",
        unit: l.unit || "",
        date: l.date || l.collectedAt || l.createdAt || "",
      }));
    } catch {}
  }

  if (wantConditions) {
    try {
      auditAccess(userId, patientId, "Condition", `Granular context: loading conditions (ids: ${selection.conditionIds?.join(",") || "all in category"})`);
      const conditions = await storage.getConditionSpecificPROMs(patientId);
      let filtered = conditions;
      if (selection.conditionIds && selection.conditionIds.length > 0) {
        const idSet = new Set(selection.conditionIds);
        filtered = conditions.filter((c: any) => idSet.has(c.id?.toString()) || idSet.has(`cond-${c.conditionType}`));
      }
      filtered = filtered.filter((c: any) => inTimeRange(c.createdAt || c.diagnosedDate));
      context.conditions = filtered.slice(0, 20).map((c: any) => ({
        name: c.conditionType || c.name || "Condition",
        diagnosedDate: c.createdAt || c.diagnosedDate || "",
      }));
    } catch {}
  }

  if (wantMeds) {
    try {
      auditAccess(userId, patientId, "Medication", `Granular context: loading medications (ids: ${selection.medicationIds?.join(",") || "all in category"})`);
      const medications = await storage.getMedicationsByPatient(patientId);
      let filtered = medications;
      if (selection.medicationIds && selection.medicationIds.length > 0) {
        const idSet = new Set(selection.medicationIds);
        filtered = medications.filter((m: any) => idSet.has(m.id?.toString()) || idSet.has(`med-${m.name}`));
      }
      context.medications = filtered.slice(0, 20).map((m: any) => ({
        name: m.name || m.medicationName || "Unknown",
        dosage: m.dosage || m.dose || "",
        frequency: m.frequency || m.schedule || "",
      }));
    } catch {}
  }

  if (wantVitals) {
    try {
      auditAccess(userId, patientId, "Vital", `Granular context: loading vitals (ids: ${selection.vitalIds?.join(",") || "all in category"})`);
      const vitals = await storage.getVitalsByPatient(patientId);
      let filtered = vitals;
      if (selection.vitalIds && selection.vitalIds.length > 0) {
        const idSet = new Set(selection.vitalIds);
        filtered = vitals.filter((v: any) => idSet.has(v.id?.toString()) || idSet.has(`vital-${v.type}-${v.date}`));
      }
      filtered = filtered.filter((v: any) => inTimeRange(v.date || v.measuredAt || v.createdAt));
      context.vitals = filtered.slice(0, 20).map((v: any) => ({
        type: v.type || v.vitalType || "Vital",
        value: v.value?.toString() || "",
        date: v.date || v.measuredAt || v.createdAt || "",
      }));
    } catch {}
  }

  if (wantDocs) {
    try {
      auditAccess(userId, patientId, "Document", `Granular context: loading documents (ids: ${selection.documentIds?.join(",") || "all in category"})`);
      const documents = await storage.getDocumentInsightsByPatient(patientId);
      let filtered = documents;
      if (selection.documentIds && selection.documentIds.length > 0) {
        const idSet = new Set(selection.documentIds);
        filtered = documents.filter((d: any) => idSet.has(d.id?.toString()) || idSet.has(d.documentId));
      }
      filtered = filtered.filter((d: any) => inTimeRange(d.createdAt || d.date));
      context.recentDocuments = filtered.slice(0, 10).map((d: any) => ({
        title: d.title || d.name || d.documentId || "Document",
        type: d.documentType || d.type || "Document",
        date: d.createdAt || d.date || "",
      }));
    } catch {}
  }

  return context;
}

export default router;
