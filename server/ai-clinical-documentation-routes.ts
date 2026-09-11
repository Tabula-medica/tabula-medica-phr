import { Router, Request, Response } from "express";
import {
  generateClinicalNote,
  generateLabSummaryNote,
  suggestCodes,
  getGeneratedNote,
  getPatientNotes,
  getAllNotes,
  updateNoteStatus,
  updateNoteContent,
  getCodeHistory,
  getCommonCodes,
  NO_CDS_DISCLAIMER,
  VisitData,
  LabSummary,
} from "./services/aiClinicalDocumentationService";
import { requireUser, getUserId } from "./middleware/require-user";

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | Action: ${action} | User: ${userId} | Details: ${details}`);
}

const router = Router();
router.use(requireUser);

const ROUTES_NO_CDS_DISCLAIMER = NO_CDS_DISCLAIMER;

router.post("/notes/generate", async (req: Request, res: Response) => {
  try {
    const visitData: VisitData = req.body.visitData;
    const noteType = req.body.noteType || "soap";
    const userId = getUserId(req);
    
    if (!visitData || !visitData.patientId || !visitData.chiefComplaint) {
      return res.status(400).json({
        error: "visitData with patientId and chiefComplaint is required",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    logHipaaAudit(
      "CLINICAL_NOTE_GENERATION",
      userId,
      `AI-assisted clinical note generation for patient ${visitData.patientId}, type: ${noteType}`
    );
    
    const note = await generateClinicalNote(visitData, noteType);
    
    res.json({
      success: true,
      note,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error generating note:", error);
    res.status(500).json({
      error: "Failed to generate clinical note",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.post("/notes/lab-summary", async (req: Request, res: Response) => {
  try {
    const labSummary: LabSummary = req.body.labSummary;
    const userId = getUserId(req);
    
    if (!labSummary || !labSummary.patientId || !labSummary.results) {
      return res.status(400).json({
        error: "labSummary with patientId and results is required",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    logHipaaAudit(
      "LAB_SUMMARY_GENERATION",
      userId,
      `AI-assisted lab summary generation for patient ${labSummary.patientId}`
    );
    
    const note = await generateLabSummaryNote(labSummary);
    
    res.json({
      success: true,
      note,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error generating lab summary:", error);
    res.status(500).json({
      error: "Failed to generate lab summary",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.post("/codes/suggest", async (req: Request, res: Response) => {
  try {
    const visitData: VisitData = req.body.visitData;
    const noteContent = req.body.noteContent;
    const userId = getUserId(req);
    
    if (!visitData || !visitData.patientId) {
      return res.status(400).json({
        error: "visitData with patientId is required",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    logHipaaAudit(
      "CODE_SUGGESTION",
      userId,
      `AI-assisted ICD/CPT code suggestion for patient ${visitData.patientId}`
    );
    
    const codes = await suggestCodes(visitData, noteContent);
    
    res.json({
      success: true,
      codes,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER,
      notice: "All code suggestions require professional coder and clinician verification before billing use."
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error suggesting codes:", error);
    res.status(500).json({
      error: "Failed to suggest codes",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.get("/codes/common", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit(
      "COMMON_CODES_ACCESS",
      userId,
      "Accessed common ICD-10 and CPT codes reference"
    );
    
    const codes = getCommonCodes();
    
    res.json({
      success: true,
      codes,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error fetching common codes:", error);
    res.status(500).json({
      error: "Failed to fetch common codes",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.get("/codes/history/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = getUserId(req);
    
    logHipaaAudit(
      "CODE_HISTORY_ACCESS",
      userId,
      `Accessed code suggestion history for patient ${patientId}`
    );
    
    const codes = getCodeHistory(patientId);
    
    res.json({
      success: true,
      patientId,
      codes,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error fetching code history:", error);
    res.status(500).json({
      error: "Failed to fetch code history",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.get("/notes", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit(
      "NOTES_LIST_ACCESS",
      userId,
      "Accessed AI-generated clinical notes list"
    );
    
    const notes = getAllNotes();
    
    res.json({
      success: true,
      notes,
      count: notes.length,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error fetching notes:", error);
    res.status(500).json({
      error: "Failed to fetch notes",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.get("/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const userId = getUserId(req);
    
    logHipaaAudit(
      "NOTE_ACCESS",
      userId,
      `Accessed AI-generated clinical note ${noteId}`
    );
    
    const note = getGeneratedNote(noteId);
    
    if (!note) {
      return res.status(404).json({
        error: "Note not found",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    res.json({
      success: true,
      note,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error fetching note:", error);
    res.status(500).json({
      error: "Failed to fetch note",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.get("/notes/patient/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = getUserId(req);
    
    logHipaaAudit(
      "PATIENT_NOTES_ACCESS",
      userId,
      `Accessed AI-generated clinical notes for patient ${patientId}`
    );
    
    const notes = getPatientNotes(patientId);
    
    res.json({
      success: true,
      patientId,
      notes,
      count: notes.length,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error fetching patient notes:", error);
    res.status(500).json({
      error: "Failed to fetch patient notes",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.patch("/notes/:noteId/status", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { status } = req.body;
    const userId = getUserId(req);

    if (!status || !["draft", "reviewed", "finalized"].includes(status)) {
      return res.status(400).json({
        error: "Valid status (draft, reviewed, finalized) is required",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    logHipaaAudit(
      "NOTE_STATUS_UPDATE",
      userId,
      `Updated clinical note ${noteId} status to ${status}`
    );
    
    const note = updateNoteStatus(noteId, status);
    
    if (!note) {
      return res.status(404).json({
        error: "Note not found",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    res.json({
      success: true,
      note,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error updating note status:", error);
    res.status(500).json({
      error: "Failed to update note status",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.patch("/notes/:noteId/content", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { content } = req.body;
    const userId = getUserId(req);

    if (!content) {
      return res.status(400).json({
        error: "content object is required",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    logHipaaAudit(
      "NOTE_CONTENT_UPDATE",
      userId,
      `Updated clinical note ${noteId} content`
    );
    
    const note = updateNoteContent(noteId, content);
    
    if (!note) {
      return res.status(404).json({
        error: "Note not found",
        disclaimer: ROUTES_NO_CDS_DISCLAIMER
      });
    }
    
    res.json({
      success: true,
      note,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error updating note content:", error);
    res.status(500).json({
      error: "Failed to update note content",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit(
      "DOCUMENTATION_DASHBOARD_ACCESS",
      userId,
      "Accessed AI clinical documentation dashboard"
    );
    
    const allNotes = getAllNotes();
    const commonCodes = getCommonCodes();
    
    const stats = {
      totalNotes: allNotes.length,
      draftNotes: allNotes.filter(n => n.status === "draft").length,
      reviewedNotes: allNotes.filter(n => n.status === "reviewed").length,
      finalizedNotes: allNotes.filter(n => n.status === "finalized").length,
      notesByType: {
        soap: allNotes.filter(n => n.noteType === "soap").length,
        progress: allNotes.filter(n => n.noteType === "progress").length,
        discharge: allNotes.filter(n => n.noteType === "discharge").length,
        procedure: allNotes.filter(n => n.noteType === "procedure").length,
        consultation: allNotes.filter(n => n.noteType === "consultation").length
      },
      recentNotes: allNotes
        .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
        .slice(0, 5)
    };
    
    res.json({
      success: true,
      stats,
      commonCodes,
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error fetching dashboard:", error);
    res.status(500).json({
      error: "Failed to fetch dashboard",
      disclaimer: ROUTES_NO_CDS_DISCLAIMER
    });
  }
});

export default router;

console.log("[AIClinicalDocumentation] Routes module loaded");
