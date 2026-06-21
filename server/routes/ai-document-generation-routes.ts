import { Router, type Request, type Response } from "express";
import * as docGenService from "../services/ai-document-generation-service";
import * as workflowService from "../services/ai-document-workflow-service";
import * as autofillService from "../services/ai-document-autofill-service";

const router = Router();

router.get("/types", (_req: Request, res: Response) => {
  try {
    const types = docGenService.getDocumentTypes();
    res.json({ types });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/types/:id", (req: Request, res: Response) => {
  try {
    const docType = docGenService.getDocumentType(req.params.id);
    if (!docType) return res.status(404).json({ error: "Document type not found" });
    res.json({ type: docType });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { documentTypeId, patientId, patientName, context, additionalInstructions } = req.body;

    if (!documentTypeId) {
      return res.status(400).json({ error: "documentTypeId is required" });
    }
    if (!context || typeof context !== "object") {
      return res.status(400).json({ error: "context object is required" });
    }

    const draft = await docGenService.generateDocument({
      documentTypeId,
      userId,
      patientId,
      patientName,
      context,
      additionalInstructions,
    });

    res.json({ draft });
  } catch (error: any) {
    console.error("[DocumentGeneration] Generate error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

router.get("/drafts", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const userDrafts = docGenService.getDrafts(userId);
    res.json({ drafts: userDrafts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/drafts/:id", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const draft = docGenService.getDraft(req.params.id);
    if (!draft || draft.userId !== userId) return res.status(404).json({ error: "Draft not found" });
    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/drafts/:id/content", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { content } = req.body;
    if (typeof content !== "string") return res.status(400).json({ error: "content is required" });

    const draft = docGenService.updateDraftContent(req.params.id, content, userId);
    if (!draft) return res.status(404).json({ error: "Draft not found or access denied" });
    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/drafts/:id/status", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { status } = req.body;
    if (!["draft", "reviewed", "finalized", "discarded"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const draft = docGenService.updateDraftStatus(req.params.id, status, userId);
    if (!draft) return res.status(404).json({ error: "Draft not found or access denied" });
    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/drafts/:id", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const deleted = docGenService.deleteDraft(req.params.id, userId);
    if (!deleted) return res.status(404).json({ error: "Draft not found or access denied" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const stats = docGenService.getStats(userId);
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/workflows/rules", (req: Request, res: Response) => {
  try {
    const rules = workflowService.getRules();
    res.json({ rules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/workflows/rules/:id", (req: Request, res: Response) => {
  try {
    const rule = workflowService.getRule(req.params.id);
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json({ rule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/workflows/rules", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { name, description, eventType, eventFilters, targetDocumentTypeId, contextTemplate, priority } = req.body;

    if (!name || !eventType || !targetDocumentTypeId) {
      return res.status(400).json({ error: "name, eventType, and targetDocumentTypeId are required" });
    }

    const rule = workflowService.createRule({
      name,
      description: description || "",
      eventType,
      eventFilters: eventFilters || {},
      targetDocumentTypeId,
      contextTemplate: contextTemplate || {},
      priority: priority || "medium",
      userId,
    });

    res.json({ rule });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch("/workflows/rules/:id", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const rule = workflowService.updateRule(req.params.id, req.body, userId);
    if (!rule) return res.status(404).json({ error: "Rule not found" });
    res.json({ rule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/workflows/rules/:id", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const deleted = workflowService.deleteRule(req.params.id, userId);
    if (!deleted) return res.status(404).json({ error: "Rule not found" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/workflows/event-types", (_req: Request, res: Response) => {
  try {
    const eventTypes = workflowService.getEventTypes();
    res.json({ eventTypes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/workflows/events", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { eventType, patientId, patientName, data, source } = req.body;

    if (!eventType || !patientId || !patientName) {
      return res.status(400).json({ error: "eventType, patientId, and patientName are required" });
    }

    const event: workflowService.ClinicalEvent = {
      eventType,
      patientId,
      patientName,
      data: data || {},
      timestamp: new Date().toISOString(),
      source: source || "manual",
    };

    const newSuggestions = workflowService.evaluateEvent(event, userId);
    res.json({
      event,
      suggestionsGenerated: newSuggestions.length,
      suggestions: newSuggestions,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/workflows/suggestions", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const status = req.query.status as string | undefined;
    const suggestions = workflowService.getSuggestions(userId, status);
    const pendingCount = workflowService.getPendingSuggestionCount(userId);
    res.json({ suggestions, pendingCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/workflows/suggestions/:id/accept", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const additionalContext = req.body.additionalContext;
    const result = await workflowService.acceptSuggestion(req.params.id, userId, additionalContext);
    res.json(result);
  } catch (error: any) {
    console.error("[DocumentWorkflow] Accept error:", error.message);
    res.status(400).json({ error: error.message });
  }
});

router.post("/workflows/suggestions/:id/dismiss", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const suggestion = workflowService.dismissSuggestion(req.params.id, userId);
    if (!suggestion) return res.status(404).json({ error: "Suggestion not found" });
    res.json({ suggestion });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/workflows/stats", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const stats = workflowService.getWorkflowStats(userId);
    res.json({ stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/workflows/recent-events", (_req: Request, res: Response) => {
  try {
    const events = workflowService.getRecentEvents();
    res.json({ events });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/autofill/scenarios", (_req: Request, res: Response) => {
  try {
    const scenarios = autofillService.getAutoFillScenarios();
    res.json({ scenarios });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/autofill/evaluate", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { triggerType, data, patientContext } = req.body;

    if (!triggerType || !data) {
      return res.status(400).json({ error: "triggerType and data are required" });
    }

    const results = autofillService.evaluateAutoFill(
      { triggerType, data, patientContext },
      userId
    );

    res.json({ results, count: results.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/autofill/patient/:patientId/:documentTypeId", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { patientId, documentTypeId } = req.params;

    const autoFilledData = autofillService.getPatientAutoFillData(patientId, documentTypeId, userId);
    if (!autoFilledData) {
      return res.status(404).json({ error: "Patient or document type not found" });
    }

    res.json({ fields: autoFilledData, patientId, documentTypeId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
