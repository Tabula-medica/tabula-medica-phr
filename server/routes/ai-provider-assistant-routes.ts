import { Router, Request, Response } from "express";
import * as assistantService from "../services/ai-provider-assistant-service";

const router = Router();

router.get("/suggestions", (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const patientId = req.query.patientId as string;
    const activeTab = (req.query.activeTab as string) || "records";

    if (!patientId) {
      return res.status(400).json({ error: "patientId is required" });
    }

    const suggestions = assistantService.getProactiveSuggestions(patientId, activeTab, userId);
    res.json({ suggestions, noCdsDisclaimer: "AI suggestions are for informational purposes only and do not constitute clinical decision support." });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/summarize", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { patientId, patientName, selectedDataPoints, summaryType, additionalInstructions } = req.body;

    if (!patientId || !patientName) {
      return res.status(400).json({ error: "patientId and patientName are required" });
    }
    if (!selectedDataPoints || !Array.isArray(selectedDataPoints) || selectedDataPoints.length === 0) {
      return res.status(400).json({ error: "At least one data point must be selected" });
    }
    if (!summaryType || !["clinical-note", "progress-update", "handoff-summary", "brief-overview"].includes(summaryType)) {
      return res.status(400).json({ error: "Valid summaryType is required: clinical-note, progress-update, handoff-summary, or brief-overview" });
    }

    const result = await assistantService.summarizeSelectedData({
      patientId,
      patientName,
      userId,
      selectedDataPoints,
      summaryType,
      additionalInstructions,
    });

    res.json({ summary: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/quick-document", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "current-user";
    const { patientId, patientName, documentTypeId, selectedDataPoints, additionalContext } = req.body;

    if (!patientId || !patientName || !documentTypeId) {
      return res.status(400).json({ error: "patientId, patientName, and documentTypeId are required" });
    }

    const draft = await assistantService.quickGenerateDocument({
      patientId,
      patientName,
      userId,
      documentTypeId,
      selectedDataPoints,
      additionalContext,
    });

    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/document-types", (_req: Request, res: Response) => {
  try {
    const types = assistantService.getAvailableDocumentTypes();
    res.json({ types });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
