import { Router, type Request, type Response } from "express";
import * as docService from "../services/ai-automated-documentation-service";

const router = Router();

router.get("/governance-check", (_req: Request, res: Response) => {
  try {
    const result = docService.checkGovernanceCompliance();
    res.json({ governance: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", (_req: Request, res: Response) => {
  try {
    const stats = docService.getStats();
    const governance = docService.checkGovernanceCompliance();
    res.json({ stats, governance });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioBase64, mimeType, clinicianId } = req.body;
    if (!audioBase64 || !clinicianId) {
      return res.status(400).json({ error: "audioBase64 and clinicianId are required" });
    }

    const result = await docService.transcribeVoiceNote({
      audioBase64,
      mimeType: mimeType || "audio/webm",
      clinicianId,
    });

    res.json({ transcription: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { structuredData, transcription, noteType, clinicianId } = req.body;
    if (!structuredData || !clinicianId) {
      return res.status(400).json({ error: "structuredData and clinicianId are required" });
    }

    if (!structuredData.patientId || !structuredData.patientName || !structuredData.chiefComplaint) {
      return res.status(400).json({ error: "structuredData must include patientId, patientName, and chiefComplaint" });
    }

    const draft = await docService.generateDraftNote(
      structuredData,
      transcription || null,
      noteType || "soap",
      clinicianId,
    );

    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/drafts", (req: Request, res: Response) => {
  try {
    const { patientId, status, clinicianId } = req.query;
    const drafts = docService.getDrafts({
      patientId: patientId as string,
      status: status as string,
      clinicianId: clinicianId as string,
    });
    res.json({ drafts, total: drafts.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/drafts/:id", (req: Request, res: Response) => {
  try {
    const draft = docService.getDraft(req.params.id);
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/drafts/:id/status", (req: Request, res: Response) => {
  try {
    const { status, clinicianId } = req.body;
    if (!status || !clinicianId) {
      return res.status(400).json({ error: "status and clinicianId are required" });
    }

    const validStatuses = ["draft", "pending_review", "reviewed", "finalized"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const draft = docService.updateDraftStatus(req.params.id, status, clinicianId);
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/drafts/:id/content", (req: Request, res: Response) => {
  try {
    const { content, clinicianId } = req.body;
    if (!content || !clinicianId) {
      return res.status(400).json({ error: "content and clinicianId are required" });
    }

    const draft = docService.updateDraftContent(req.params.id, content, clinicianId);
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" });
    }
    res.json({ draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
