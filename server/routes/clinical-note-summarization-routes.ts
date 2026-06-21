import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  summarizeClinicalNote,
  reportSummaryError,
  getErrorReports,
  updateErrorStatus,
  ClinicalNoteSummary,
  SummaryError,
} from "../services/ai-clinical-note-summarization";

const router = Router();

const summarizeRequestSchema = z.object({
  noteId: z.string(),
  content: z.string().min(10),
  noteType: z.string(),
  author: z.string().optional(),
  facility: z.string().optional(),
  dateOfService: z.string().optional(),
});

const reportErrorSchema = z.object({
  noteId: z.string(),
  summaryId: z.string(),
  errorType: z.enum(["accuracy", "missing_info", "incorrect_extraction", "other"]),
  description: z.string().min(10),
  suggestedCorrection: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "reviewed", "resolved"]),
});

router.post("/summarize", async (req: Request, res: Response) => {
  console.log("[ClinicalNoteSummarization] POST /summarize received");
  
  try {
    const validation = summarizeRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    const { noteId, content, noteType, author, facility, dateOfService } = validation.data;

    const summary = await summarizeClinicalNote(
      noteId,
      content,
      noteType,
      author,
      facility,
      dateOfService
    );

    console.log("[ClinicalNoteSummarization] Summary generated for note:", noteId);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("[ClinicalNoteSummarization] Error generating summary:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate summary",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/report-error", async (req: Request, res: Response) => {
  console.log("[ClinicalNoteSummarization] POST /report-error received");
  
  try {
    const validation = reportErrorSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request",
        details: validation.error.errors,
      });
    }

    const { noteId, summaryId, errorType, description, suggestedCorrection } = validation.data;

    const errorReport = reportSummaryError(
      noteId,
      summaryId,
      errorType,
      description,
      suggestedCorrection
    );

    console.log("[ClinicalNoteSummarization] Error reported:", errorReport.id);

    res.json({
      success: true,
      data: errorReport,
    });
  } catch (error) {
    console.error("[ClinicalNoteSummarization] Error reporting error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to report error",
    });
  }
});

router.get("/errors", async (req: Request, res: Response) => {
  const noteId = req.query.noteId as string | undefined;
  const errors = getErrorReports(noteId);

  res.json({
    success: true,
    data: errors,
  });
});

router.patch("/errors/:errorId/status", async (req: Request, res: Response) => {
  try {
    const validation = updateStatusSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
      });
    }

    const updated = updateErrorStatus(req.params.errorId, validation.data.status);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Error report not found",
      });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to update status",
    });
  }
});

export function registerClinicalNoteSummarizationRoutes(app: any) {
  app.use("/api/clinical-note-summary", router);
  console.log("[Routes] Clinical Note Summarization routes registered at /api/clinical-note-summary/*");
}

export default router;
