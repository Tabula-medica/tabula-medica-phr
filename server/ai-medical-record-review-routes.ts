import { Router, Request, Response } from "express";
import { z } from "zod";
import { aiMedicalRecordReviewService } from "./services/ai-medical-record-review-service";

const router = Router();

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI-generated summaries are for INFORMATIONAL purposes only. They do NOT constitute clinical decision support or medical advice. All clinical decisions must be made by qualified healthcare professionals who have reviewed the complete medical record.";

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = aiMedicalRecordReviewService.getStats();
    res.json({
      success: true,
      data: stats,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[MedicalRecordReview] Error fetching stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

router.get("/patients", async (_req: Request, res: Response) => {
  try {
    const summaries = aiMedicalRecordReviewService.getAllSummaries();
    res.json({
      success: true,
      data: summaries,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[MedicalRecordReview] Error fetching patients:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient summaries" });
  }
});

router.get("/patients/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const summary = aiMedicalRecordReviewService.getPatientSummary(patientId);
    
    if (!summary) {
      res.status(404).json({ success: false, error: "Patient summary not found" });
      return;
    }

    res.json({
      success: true,
      data: summary,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[MedicalRecordReview] Error fetching patient:", error);
    res.status(500).json({ success: false, error: "Failed to fetch patient summary" });
  }
});

router.get("/patients/:patientId/notes", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const notes = aiMedicalRecordReviewService.getClinicalNotes(patientId);
    
    res.json({
      success: true,
      data: notes,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[MedicalRecordReview] Error fetching notes:", error);
    res.status(500).json({ success: false, error: "Failed to fetch clinical notes" });
  }
});

router.post("/patients/:patientId/generate-summary", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { patientName } = req.body;
    
    const summary = await aiMedicalRecordReviewService.generatePatientSummary(
      patientId,
      patientName || "Unknown Patient"
    );
    
    res.json({
      success: true,
      data: summary,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[MedicalRecordReview] Error generating summary:", error);
    res.status(500).json({ success: false, error: "Failed to generate patient summary" });
  }
});

const summarizeNoteSchema = z.object({
  noteContent: z.string().min(10),
  noteType: z.string()
});

router.post("/summarize-note", async (req: Request, res: Response) => {
  try {
    const validation = summarizeNoteSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ success: false, error: "Invalid request body" });
      return;
    }

    const { noteContent, noteType } = validation.data;
    const result = await aiMedicalRecordReviewService.summarizeClinicalNote(noteContent, noteType);
    
    res.json({
      success: true,
      data: result,
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[MedicalRecordReview] Error summarizing note:", error);
    res.status(500).json({ success: false, error: "Failed to summarize clinical note" });
  }
});

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const patientId = req.query.patientId as string | undefined;
    
    if (!query || query.length < 2) {
      res.status(400).json({ success: false, error: "Search query must be at least 2 characters" });
      return;
    }

    const results = aiMedicalRecordReviewService.searchRecords(query, patientId);
    
    res.json({
      success: true,
      data: {
        query,
        resultCount: results.length,
        results
      },
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[MedicalRecordReview] Error searching records:", error);
    res.status(500).json({ success: false, error: "Failed to search records" });
  }
});

export default router;
