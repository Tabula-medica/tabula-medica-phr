import { Express } from "express";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";
import {
  generateClinicalNote,
  startScribeSession,
  addInputToSession,
  getSession,
  completeSession,
  updateNoteStatus,
  summarizeConversation,
  generatePostVisitSummary,
  getRecentNotes,
  getNoteTypes,
  ScribeInput,
  ClinicalNote,
} from "./services/ai-medical-scribe-service";

const NO_CDS_DISCLAIMER = "IMPORTANT: This AI-generated clinical documentation is for EDUCATIONAL and DOCUMENTATION ASSISTANCE purposes only. It is NOT a substitute for clinical judgment. All notes must be reviewed, verified, and signed by a licensed healthcare provider before becoming part of the official medical record. This system does NOT provide clinical decision support.";

function logHipaaAudit(action: string, userId: string, patientId?: string, details?: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][MedicalScribeRoutes] ${timestamp} | Action: ${action} | User: ${userId} | Patient: ${patientId || 'N/A'} | Details: ${details || 'N/A'}`);
}

export function registerMedicalScribeRoutes(app: Express) {
  app.get("/api/medical-scribe/note-types", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      logHipaaAudit("GET_NOTE_TYPES", userId, undefined, "Fetching available note types");
      
      const result = getNoteTypes();
      res.json(result);
    } catch (error) {
      console.error("[MedicalScribe] Error fetching note types:", error);
      res.status(500).json({ error: "Failed to fetch note types", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post("/api/medical-scribe/generate", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const input: ScribeInput = req.body;
      
      if (!input.content || typeof input.content !== "string") {
        return res.status(400).json({ error: "Content is required", disclaimer: NO_CDS_DISCLAIMER });
      }
      
      if (!input.inputType) {
        input.inputType = "free_text";
      }
      
      logHipaaAudit("GENERATE_NOTE_REQUEST", userId, input.patientId, `Input type: ${input.inputType}, Note type: ${input.noteType || 'SOAP'}`);
      
      const result = await generateClinicalNote(userId, input);
      res.json(result);
    } catch (error) {
      console.error("[MedicalScribe] Error generating note:", error);
      res.status(500).json({ error: "Failed to generate clinical note", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post("/api/medical-scribe/sessions", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { patientId } = req.body;
      
      logHipaaAudit("START_SESSION_REQUEST", userId, patientId, "Starting new scribe session");
      
      const result = await startScribeSession(userId, patientId);
      res.json(result);
    } catch (error) {
      console.error("[MedicalScribe] Error starting session:", error);
      res.status(500).json({ error: "Failed to start scribe session", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.get("/api/medical-scribe/sessions/:sessionId", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { sessionId } = req.params;
      
      logHipaaAudit("GET_SESSION_REQUEST", userId, undefined, `Session: ${sessionId}`);
      
      const result = await getSession(userId, sessionId);
      res.json(result);
    } catch (error: any) {
      console.error("[MedicalScribe] Error getting session:", error);
      if (error.message === "Session not found") {
        return res.status(404).json({ error: "Session not found", disclaimer: NO_CDS_DISCLAIMER });
      }
      if (error.message === "Unauthorized access to session") {
        return res.status(403).json({ error: "Unauthorized", disclaimer: NO_CDS_DISCLAIMER });
      }
      res.status(500).json({ error: "Failed to get session", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post("/api/medical-scribe/sessions/:sessionId/input", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { sessionId } = req.params;
      const input: ScribeInput = req.body;
      
      if (!input.content || typeof input.content !== "string") {
        return res.status(400).json({ error: "Content is required", disclaimer: NO_CDS_DISCLAIMER });
      }
      
      if (!input.inputType) {
        input.inputType = "free_text";
      }
      
      logHipaaAudit("ADD_SESSION_INPUT_REQUEST", userId, input.patientId, `Session: ${sessionId}`);
      
      const result = await addInputToSession(userId, sessionId, input);
      res.json(result);
    } catch (error: any) {
      console.error("[MedicalScribe] Error adding input to session:", error);
      if (error.message === "Session not found") {
        return res.status(404).json({ error: "Session not found", disclaimer: NO_CDS_DISCLAIMER });
      }
      if (error.message === "Unauthorized access to session") {
        return res.status(403).json({ error: "Unauthorized", disclaimer: NO_CDS_DISCLAIMER });
      }
      res.status(500).json({ error: "Failed to add input to session", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post("/api/medical-scribe/sessions/:sessionId/complete", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { sessionId } = req.params;
      
      logHipaaAudit("COMPLETE_SESSION_REQUEST", userId, undefined, `Session: ${sessionId}`);
      
      const result = await completeSession(userId, sessionId);
      res.json(result);
    } catch (error: any) {
      console.error("[MedicalScribe] Error completing session:", error);
      if (error.message === "Session not found") {
        return res.status(404).json({ error: "Session not found", disclaimer: NO_CDS_DISCLAIMER });
      }
      res.status(500).json({ error: "Failed to complete session", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.patch("/api/medical-scribe/notes/:noteId/status", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { noteId } = req.params;
      const { status, reviewerNotes } = req.body;
      
      if (!status || !["draft", "pending_review", "reviewed", "finalized"].includes(status)) {
        return res.status(400).json({ error: "Valid status is required", disclaimer: NO_CDS_DISCLAIMER });
      }
      
      logHipaaAudit("UPDATE_NOTE_STATUS_REQUEST", userId, undefined, `Note: ${noteId}, Status: ${status}`);
      
      const result = await updateNoteStatus(userId, noteId, status as ClinicalNote["status"], reviewerNotes);
      res.json(result);
    } catch (error: any) {
      console.error("[MedicalScribe] Error updating note status:", error);
      if (error.message === "Unauthorized access to note") {
        return res.status(403).json({ error: "Unauthorized", disclaimer: NO_CDS_DISCLAIMER });
      }
      res.status(500).json({ error: "Failed to update note status", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post("/api/medical-scribe/summarize", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { conversation, patientId } = req.body;
      
      if (!conversation || typeof conversation !== "string") {
        return res.status(400).json({ error: "Conversation content is required", disclaimer: NO_CDS_DISCLAIMER });
      }
      
      logHipaaAudit("SUMMARIZE_REQUEST", userId, patientId, `Conversation length: ${conversation.length}`);
      
      const result = await summarizeConversation(userId, conversation, patientId);
      res.json(result);
    } catch (error) {
      console.error("[MedicalScribe] Error summarizing conversation:", error);
      res.status(500).json({ error: "Failed to summarize conversation", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.get("/api/medical-scribe/notes", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      
      logHipaaAudit("GET_RECENT_NOTES_REQUEST", userId, undefined, "Fetching recent notes");
      
      const result = await getRecentNotes(userId);
      res.json(result);
    } catch (error) {
      console.error("[MedicalScribe] Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post("/api/medical-scribe/post-visit-summary", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { conversation, patientId } = req.body;

      if (!conversation || typeof conversation !== "string") {
        return res.status(400).json({ error: "Conversation content is required", disclaimer: NO_CDS_DISCLAIMER });
      }

      logHipaaAudit("POST_VISIT_SUMMARY_REQUEST", userId, patientId, `Conversation length: ${conversation.length}`);

      const result = await generatePostVisitSummary(userId, conversation, patientId);
      res.json(result);
    } catch (error) {
      console.error("[MedicalScribe] Error generating post-visit summary:", error);
      res.status(500).json({ error: "Failed to generate post-visit summary", disclaimer: NO_CDS_DISCLAIMER });
    }
  });

  app.post("/api/medical-scribe/create-reminders", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? (req as any).user?.claims?.sub;
      const { actionItems, followUpAppointments } = req.body;

      if (!actionItems && !followUpAppointments) {
        return res.status(400).json({ error: "Action items or follow-up appointments required" });
      }

      logHipaaAudit("CREATE_REMINDERS_FROM_SCRIBE", userId, undefined, `Actions: ${actionItems?.length || 0}, Follow-ups: ${followUpAppointments?.length || 0}`);

      const reminders: Array<{ id: string; type: string; task: string; dueDate: string | null; status: string }> = [];

      for (const item of (actionItems || [])) {
        const dueDate = item.dueDays
          ? new Date(Date.now() + item.dueDays * 86400000).toISOString()
          : null;
        reminders.push({
          id: `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: item.category || "other",
          task: item.task,
          dueDate,
          status: "scheduled",
        });
      }

      for (const apt of (followUpAppointments || [])) {
        const dueDate = apt.dueDays
          ? new Date(Date.now() + apt.dueDays * 86400000).toISOString()
          : null;
        reminders.push({
          id: `reminder-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          type: "appointment",
          task: `Schedule: ${apt.description} (${apt.timing})`,
          dueDate,
          status: "scheduled",
        });
      }

      res.json({ reminders, count: reminders.length, disclaimer: NO_CDS_DISCLAIMER });
    } catch (error) {
      console.error("[MedicalScribe] Error creating reminders:", error);
      res.status(500).json({ error: "Failed to create reminders" });
    }
  });

  console.log("[MedicalScribeRoutes] Routes module loaded with NO-CDS compliance");
}
