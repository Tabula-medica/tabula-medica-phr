import { Router } from "express";
import * as collaborationService from "./services/caregiver-collaboration-service";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CaregiverCollabRoutes] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

router.get("/api/caregiver-collaboration/tasks/:patientId", async (req, res) => {
  try {
    const { status, assignedTo, category, caregiverId } = req.query;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }
    
    const userId = caregiverId as string;
    const tasks = collaborationService.getPatientTasks(req.params.patientId, {
      status: status as any,
      assignedTo: assignedTo as string,
      category: category as any,
    });

    logHipaaAudit("VIEW_TASKS", userId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${tasks.length} tasks`);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error("[CaregiverCollaboration] Get tasks error:", error);
    res.status(500).json({ success: false, error: "Failed to get tasks" });
  }
});

router.post("/api/caregiver-collaboration/tasks", async (req, res) => {
  try {
    const { patientId, createdBy, createdByName, ...taskData } = req.body;

    if (!patientId || !createdBy || !taskData.title) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const task = collaborationService.createTask(patientId, createdBy, createdByName || "Caregiver", taskData);
    logHipaaAudit("CREATE_TASK", createdBy, `Patient:${hashIdentifier(patientId)} - Created task ${task.id}: ${task.title}`);
    res.json({ success: true, data: task });
  } catch (error) {
    console.error("[CaregiverCollaboration] Create task error:", error);
    res.status(500).json({ success: false, error: "Failed to create task" });
  }
});

router.patch("/api/caregiver-collaboration/tasks/:taskId/status", async (req, res) => {
  try {
    const { userId, status, notes } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ success: false, error: "Missing userId or status" });
    }

    const task = collaborationService.updateTaskStatus(req.params.taskId, userId, status, notes);

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    logHipaaAudit("UPDATE_TASK_STATUS", userId, `Task:${req.params.taskId} - Status changed to ${status}`);
    res.json({ success: true, data: task });
  } catch (error) {
    console.error("[CaregiverCollaboration] Update task status error:", error);
    res.status(500).json({ success: false, error: "Failed to update task status" });
  }
});

router.patch("/api/caregiver-collaboration/tasks/:taskId/assign", async (req, res) => {
  try {
    const { assignedTo, assignedToName, assignedBy } = req.body;

    if (!assignedTo || !assignedToName || !assignedBy) {
      return res.status(400).json({ success: false, error: "Missing assignment fields" });
    }

    const task = collaborationService.assignTask(req.params.taskId, assignedTo, assignedToName, assignedBy);

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    logHipaaAudit("ASSIGN_TASK", assignedBy, `Task:${req.params.taskId} - Assigned to ${hashIdentifier(assignedTo)} (${assignedToName})`);
    res.json({ success: true, data: task });
  } catch (error) {
    console.error("[CaregiverCollaboration] Assign task error:", error);
    res.status(500).json({ success: false, error: "Failed to assign task" });
  }
});

router.post("/api/caregiver-collaboration/tasks/:taskId/notes", async (req, res) => {
  try {
    const { userId, userName, note } = req.body;

    if (!userId || !note) {
      return res.status(400).json({ success: false, error: "Missing userId or note" });
    }

    const task = collaborationService.addTaskNote(req.params.taskId, userId, userName || "Caregiver", note);

    if (!task) {
      return res.status(404).json({ success: false, error: "Task not found" });
    }

    logHipaaAudit("ADD_TASK_NOTE", userId, `Task:${req.params.taskId} - Added note`);
    res.json({ success: true, data: task });
  } catch (error) {
    console.error("[CaregiverCollaboration] Add task note error:", error);
    res.status(500).json({ success: false, error: "Failed to add task note" });
  }
});

router.get("/api/caregiver-collaboration/notes/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }
    
    const notes = collaborationService.getPatientSharedNotes(req.params.patientId, caregiverId);

    logHipaaAudit("VIEW_SHARED_NOTES", caregiverId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${notes.length} notes`);
    res.json({ success: true, data: notes });
  } catch (error) {
    console.error("[CaregiverCollaboration] Get shared notes error:", error);
    res.status(500).json({ success: false, error: "Failed to get shared notes" });
  }
});

router.post("/api/caregiver-collaboration/notes", async (req, res) => {
  try {
    const { patientId, authorId, authorName, ...noteData } = req.body;

    if (!patientId || !authorId || !noteData.title || !noteData.content) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const note = collaborationService.createSharedNote(patientId, authorId, authorName || "Caregiver", noteData);
    logHipaaAudit("CREATE_SHARED_NOTE", authorId, `Patient:${hashIdentifier(patientId)} - Created note ${note.id}: ${note.title}`);
    res.json({ success: true, data: note });
  } catch (error) {
    console.error("[CaregiverCollaboration] Create shared note error:", error);
    res.status(500).json({ success: false, error: "Failed to create shared note" });
  }
});

router.post("/api/caregiver-collaboration/notes/:noteId/comments", async (req, res) => {
  try {
    const { authorId, authorName, content } = req.body;

    if (!authorId || !content) {
      return res.status(400).json({ success: false, error: "Missing authorId or content" });
    }

    const note = collaborationService.addNoteComment(req.params.noteId, authorId, authorName || "Caregiver", content);

    if (!note) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }

    logHipaaAudit("ADD_NOTE_COMMENT", authorId, `Note:${req.params.noteId} - Added comment`);
    res.json({ success: true, data: note });
  } catch (error) {
    console.error("[CaregiverCollaboration] Add note comment error:", error);
    res.status(500).json({ success: false, error: "Failed to add comment" });
  }
});

router.post("/api/caregiver-collaboration/notes/:noteId/reactions", async (req, res) => {
  try {
    const { userId, userName, reaction } = req.body;

    if (!userId || !reaction) {
      return res.status(400).json({ success: false, error: "Missing userId or reaction" });
    }

    const note = collaborationService.addNoteReaction(req.params.noteId, userId, userName || "Caregiver", reaction);

    if (!note) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }

    logHipaaAudit("ADD_NOTE_REACTION", userId, `Note:${req.params.noteId} - Added reaction: ${reaction}`);
    res.json({ success: true, data: note });
  } catch (error) {
    console.error("[CaregiverCollaboration] Add note reaction error:", error);
    res.status(500).json({ success: false, error: "Failed to add reaction" });
  }
});

router.post("/api/caregiver-collaboration/notes/:noteId/pin", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const note = collaborationService.toggleNotePin(req.params.noteId, userId);

    if (!note) {
      return res.status(404).json({ success: false, error: "Note not found" });
    }

    logHipaaAudit("TOGGLE_NOTE_PIN", userId, `Note:${req.params.noteId} - Pinned: ${note.isPinned}`);
    res.json({ success: true, data: note });
  } catch (error) {
    console.error("[CaregiverCollaboration] Toggle pin error:", error);
    res.status(500).json({ success: false, error: "Failed to toggle pin" });
  }
});

router.get("/api/caregiver-collaboration/calendar/:patientId", async (req, res) => {
  try {
    const { startDate, endDate, caregiverId } = req.query;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }
    
    const userId = caregiverId as string;
    const events = collaborationService.getPatientCalendarEvents(
      req.params.patientId,
      startDate as string,
      endDate as string
    );

    logHipaaAudit("VIEW_CALENDAR", userId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${events.length} calendar events`);
    res.json({ success: true, data: events });
  } catch (error) {
    console.error("[CaregiverCollaboration] Get calendar events error:", error);
    res.status(500).json({ success: false, error: "Failed to get calendar events" });
  }
});

router.post("/api/caregiver-collaboration/calendar", async (req, res) => {
  try {
    const { patientId, createdBy, createdByName, ...eventData } = req.body;

    if (!patientId || !createdBy || !eventData.title || !eventData.startTime) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const event = collaborationService.createCalendarEvent(patientId, createdBy, createdByName || "Caregiver", eventData);
    logHipaaAudit("CREATE_CALENDAR_EVENT", createdBy, `Patient:${hashIdentifier(patientId)} - Created event ${event.id}: ${event.title}`);
    res.json({ success: true, data: event });
  } catch (error) {
    console.error("[CaregiverCollaboration] Create calendar event error:", error);
    res.status(500).json({ success: false, error: "Failed to create calendar event" });
  }
});

router.patch("/api/caregiver-collaboration/calendar/:eventId", async (req, res) => {
  try {
    const { userId, ...updates } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const event = collaborationService.updateCalendarEvent(req.params.eventId, userId, updates);

    if (!event) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    logHipaaAudit("UPDATE_CALENDAR_EVENT", userId, `Event:${req.params.eventId} - Updated`);
    res.json({ success: true, data: event });
  } catch (error) {
    console.error("[CaregiverCollaboration] Update calendar event error:", error);
    res.status(500).json({ success: false, error: "Failed to update calendar event" });
  }
});

router.delete("/api/caregiver-collaboration/calendar/:eventId", async (req, res) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const deleted = collaborationService.deleteCalendarEvent(req.params.eventId, userId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }

    logHipaaAudit("DELETE_CALENDAR_EVENT", userId, `Event:${req.params.eventId} - Deleted`);
    res.json({ success: true, message: "Event deleted" });
  } catch (error) {
    console.error("[CaregiverCollaboration] Delete calendar event error:", error);
    res.status(500).json({ success: false, error: "Failed to delete calendar event" });
  }
});

router.get("/api/caregiver-collaboration/shifts/:patientId", async (req, res) => {
  try {
    const { startDate, endDate, caregiverId } = req.query;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }
    
    const userId = caregiverId as string;
    const shifts = collaborationService.getPatientShifts(
      req.params.patientId,
      startDate as string,
      endDate as string
    );

    logHipaaAudit("VIEW_SHIFTS", userId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved ${shifts.length} shifts`);
    res.json({ success: true, data: shifts });
  } catch (error) {
    console.error("[CaregiverCollaboration] Get shifts error:", error);
    res.status(500).json({ success: false, error: "Failed to get shifts" });
  }
});

router.post("/api/caregiver-collaboration/shifts", async (req, res) => {
  try {
    const { patientId, caregiverId, caregiverName, ...shiftData } = req.body;

    if (!patientId || !caregiverId || !caregiverName || !shiftData.startTime || !shiftData.endTime) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const shift = collaborationService.createCaregiverShift(patientId, caregiverId, caregiverName, shiftData);
    logHipaaAudit("CREATE_SHIFT", caregiverId, `Patient:${hashIdentifier(patientId)} - Created shift ${shift.id}`);
    res.json({ success: true, data: shift });
  } catch (error) {
    console.error("[CaregiverCollaboration] Create shift error:", error);
    res.status(500).json({ success: false, error: "Failed to create shift" });
  }
});

router.patch("/api/caregiver-collaboration/shifts/:shiftId/status", async (req, res) => {
  try {
    const { status, handoffNotes, userId } = req.body;

    if (!status || !userId) {
      return res.status(400).json({ success: false, error: "Missing status or userId - required for audit compliance" });
    }

    const shift = collaborationService.updateShiftStatus(req.params.shiftId, status, handoffNotes);

    if (!shift) {
      return res.status(404).json({ success: false, error: "Shift not found" });
    }

    logHipaaAudit("UPDATE_SHIFT_STATUS", userId, `Shift:${req.params.shiftId} - Status changed to ${status}`);
    res.json({ success: true, data: shift });
  } catch (error) {
    console.error("[CaregiverCollaboration] Update shift status error:", error);
    res.status(500).json({ success: false, error: "Failed to update shift status" });
  }
});

router.get("/api/caregiver-collaboration/summary/:patientId", async (req, res) => {
  try {
    const caregiverId = req.query.caregiverId as string;
    
    if (!caregiverId) {
      return res.status(400).json({ success: false, error: "Missing caregiverId - required for audit compliance" });
    }
    
    const summary = collaborationService.getCollaborationSummary(req.params.patientId);
    logHipaaAudit("VIEW_COLLABORATION_SUMMARY", caregiverId, `Patient:${hashIdentifier(req.params.patientId)} - Retrieved summary`);
    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("[CaregiverCollaboration] Get summary error:", error);
    res.status(500).json({ success: false, error: "Failed to get summary" });
  }
});

export function registerCaregiverCollaborationRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Caregiver Collaboration routes registered at /api/caregiver-collaboration/*");
}

export default router;
