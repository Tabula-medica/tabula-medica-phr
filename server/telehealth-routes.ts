import { Router, Request, Response } from "express";
import type {
  VideoAppointment,
  VideoSession,
  VideoParticipant,
  VideoPatientContext,
  VideoCallLog,
  VideoCallStatus,
} from "@shared/schema";
import { insertVideoAppointmentSchema, updateVideoAppointmentSchema, insertTelehealthReminderPreferenceSchema } from "@shared/schema";
import { logPhiAccess } from "./security/hipaa-audit";
import { reminderService } from "./telehealth-reminder-service";
import { generateTelehealthSummary, type TelehealthSessionContext } from "./services/ai-telehealth-summary-service";
import { storage } from "./storage";

const router = Router();

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function requireAuth(req: Request, res: Response): string | null {
  const userId = (req as any).session?.userId || (req as any).user?.id || "current-user";
  return userId;
}

const appointments: VideoAppointment[] = [
  {
    id: "apt-001",
    patientId: "patient-001",
    clinicianId: "clinician-001",
    patientName: "John Smith",
    clinicianName: "Dr. Sarah Johnson",
    scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
    scheduledEndTime: new Date(Date.now() + 5400000).toISOString(),
    duration: 30,
    reason: "Follow-up consultation for diabetes management",
    status: "scheduled",
    roomId: "room-001",
    reminderSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "apt-002",
    patientId: "patient-002",
    clinicianId: "clinician-001",
    patientName: "Emily Davis",
    clinicianName: "Dr. Sarah Johnson",
    scheduledStartTime: new Date(Date.now() + 7200000).toISOString(),
    scheduledEndTime: new Date(Date.now() + 9000000).toISOString(),
    duration: 30,
    reason: "Annual wellness check",
    status: "scheduled",
    roomId: "room-002",
    reminderSent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const sessions: VideoSession[] = [];
const callLogs: VideoCallLog[] = [];

(async () => {
  try {
    for (const apt of appointments) {
      const existing = await storage.getTelehealthSessionByRoom(apt.roomId);
      if (!existing) {
        const ts = await storage.createTelehealthSession({
          patientId: apt.patientId,
          providerId: apt.clinicianId || "clinician-001",
          providerName: apt.clinicianName,
          scheduledAt: apt.scheduledStartTime,
          consultationType: "follow_up",
          reasonForVisit: apt.reason || "Telehealth consultation",
        });
        await storage.updateTelehealthSession(ts.id, { roomId: apt.roomId });
      }
    }
    console.log("[Telehealth] Sample appointments synced with storage sessions");
  } catch (e) {
    console.error("[Telehealth] Failed to seed storage sessions:", e);
  }
})();

const samplePatientContexts: Record<string, VideoPatientContext> = {
  "patient-001": {
    patientId: "patient-001",
    patientName: "John Smith",
    dateOfBirth: "1965-03-15",
    conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
    medications: ["Metformin 1000mg", "Lisinopril 10mg", "Atorvastatin 20mg"],
    allergies: ["Penicillin", "Sulfa drugs"],
    recentVisits: [
      { date: "2024-11-15", reason: "Quarterly diabetes check", provider: "Dr. Sarah Johnson" },
      { date: "2024-08-10", reason: "Blood pressure follow-up", provider: "Dr. Sarah Johnson" },
    ],
    vitalSigns: [
      { type: "Blood Pressure", value: "138/85 mmHg", date: "2024-11-15" },
      { type: "Blood Glucose", value: "142 mg/dL", date: "2024-11-15" },
      { type: "Weight", value: "185 lbs", date: "2024-11-15" },
    ],
    upcomingAppointments: [
      { date: new Date(Date.now() + 86400000 * 30).toISOString(), reason: "Lab work review" },
    ],
  },
  "patient-002": {
    patientId: "patient-002",
    patientName: "Emily Davis",
    dateOfBirth: "1988-07-22",
    conditions: ["Asthma", "Anxiety"],
    medications: ["Albuterol inhaler PRN", "Sertraline 50mg"],
    allergies: ["None known"],
    recentVisits: [
      { date: "2024-10-20", reason: "Anxiety follow-up", provider: "Dr. Sarah Johnson" },
    ],
    vitalSigns: [
      { type: "Blood Pressure", value: "118/75 mmHg", date: "2024-10-20" },
      { type: "Weight", value: "145 lbs", date: "2024-10-20" },
    ],
    upcomingAppointments: [],
  },
};

router.get("/appointments", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  try {
    const { status, role } = req.query;
    let filtered = [...appointments];

    if (status && status !== "all") {
      filtered = filtered.filter(a => a.status === status);
    }

    if (role === "clinician") {
      filtered = filtered.filter(a => a.clinicianId === userId || userId === "current-user");
    } else if (role === "patient") {
      filtered = filtered.filter(a => a.patientId === userId || userId === "current-user");
    }

    filtered.sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());

    res.json(filtered);
  } catch (error) {
    console.error("[Telehealth] Get appointments error:", error);
    res.status(500).json({ error: "Failed to get appointments" });
  }
});

router.get("/appointments/:id", async (req: Request, res: Response) => {
  try {
    const appointment = appointments.find(a => a.id === req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    res.json(appointment);
  } catch (error) {
    console.error("[Telehealth] Get appointment error:", error);
    res.status(500).json({ error: "Failed to get appointment" });
  }
});

router.post("/appointments", async (req: Request, res: Response) => {
  try {
    const validated = insertVideoAppointmentSchema.parse(req.body);
    
    const appointment: VideoAppointment = {
      id: generateId("apt"),
      ...validated,
      status: "scheduled",
      roomId: generateId("room"),
      reminderSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    appointments.push(appointment);

    const telehealthSession = await storage.createTelehealthSession({
      patientId: appointment.patientId,
      providerId: appointment.clinicianId || "clinician-001",
      providerName: appointment.clinicianName,
      scheduledAt: appointment.scheduledStartTime,
      consultationType: "follow_up",
      reasonForVisit: appointment.reason || "Telehealth consultation",
      notes: (validated as any).notes || undefined,
    });

    await storage.updateTelehealthSession(telehealthSession.id, {
      roomId: appointment.roomId,
    });

    appointment.roomId = appointment.roomId;
    (appointment as any).telehealthSessionId = telehealthSession.id;

    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment.patientId,
      resourceType: "VideoAppointment",
      action: "write",
      details: `Telehealth appointment created: ${appointment.id}, session: ${telehealthSession.id}`,
    });
    res.status(201).json(appointment);
  } catch (error) {
    console.error("[Telehealth] Create appointment error:", error);
    res.status(400).json({ error: "Failed to create appointment" });
  }
});

router.patch("/appointments/:id", async (req: Request, res: Response) => {
  try {
    const appointment = appointments.find(a => a.id === req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const validated = updateVideoAppointmentSchema.parse(req.body);
    Object.assign(appointment, validated, { updatedAt: new Date().toISOString() });

    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment.patientId,
      resourceType: "VideoAppointment",
      action: "write",
      details: `Telehealth appointment updated: ${appointment.id}`,
    });
    res.json(appointment);
  } catch (error) {
    console.error("[Telehealth] Update appointment error:", error);
    res.status(400).json({ error: "Failed to update appointment" });
  }
});

router.delete("/appointments/:id", async (req: Request, res: Response) => {
  try {
    const index = appointments.findIndex(a => a.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    const [removed] = appointments.splice(index, 1);
    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: removed.patientId,
      resourceType: "VideoAppointment",
      action: "delete",
      details: `Telehealth appointment cancelled: ${removed.id}`,
    });
    res.json({ success: true });
  } catch (error) {
    console.error("[Telehealth] Delete appointment error:", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
});

router.post("/sessions/start", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.body;
    
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    appointment.status = "in_progress";

    let storedSession = await storage.getTelehealthSessionByRoom(appointment.roomId);
    if (!storedSession) {
      storedSession = await storage.createTelehealthSession({
        patientId: appointment.patientId,
        providerId: appointment.clinicianId || "clinician-001",
        providerName: appointment.clinicianName,
        scheduledAt: appointment.scheduledStartTime,
        consultationType: "follow_up",
        reasonForVisit: appointment.reason || "Telehealth consultation",
      });
      await storage.updateTelehealthSession(storedSession.id, {
        roomId: appointment.roomId,
      });
      storedSession = (await storage.getTelehealthSession(storedSession.id))!;
    }

    await storage.updateTelehealthSession(storedSession.id, {
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });

    const session: VideoSession = {
      id: generateId("ses"),
      appointmentId,
      roomId: appointment.roomId,
      status: "in_progress",
      startedAt: new Date().toISOString(),
      participants: [],
      patientContext: samplePatientContexts[appointment.patientId],
      recordingEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessions.push(session);

    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment.patientId,
      resourceType: "VideoSession",
      action: "write",
      details: `Telehealth session started: ${session.id} for appointment ${appointmentId}, room: ${appointment.roomId}`,
    });
    res.status(201).json(session);
  } catch (error) {
    console.error("[Telehealth] Start session error:", error);
    res.status(500).json({ error: "Failed to start session" });
  }
});

router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json(session);
  } catch (error) {
    console.error("[Telehealth] Get session error:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.get("/sessions/room/:roomId", async (req: Request, res: Response) => {
  try {
    const session = sessions.find(s => s.roomId === req.params.roomId);
    const appointment = appointments.find(a => a.roomId === req.params.roomId);
    
    if (!session && !appointment) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json({
      session,
      appointment,
      patientContext: appointment ? samplePatientContexts[appointment.patientId] : undefined,
    });
  } catch (error) {
    console.error("[Telehealth] Get room error:", error);
    res.status(500).json({ error: "Failed to get room" });
  }
});

router.post("/sessions/:id/end", async (req: Request, res: Response) => {
  try {
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    session.status = "completed";
    session.endedAt = new Date().toISOString();
    session.duration = session.startedAt 
      ? Math.round((new Date().getTime() - new Date(session.startedAt).getTime()) / 1000)
      : 0;
    session.updatedAt = new Date().toISOString();

    const appointment = appointments.find(a => a.id === session.appointmentId);
    if (appointment) {
      appointment.status = "completed";
      appointment.updatedAt = new Date().toISOString();

      const storedSession = await storage.getTelehealthSessionByRoom(appointment.roomId);
      if (storedSession) {
        await storage.updateTelehealthSession(storedSession.id, {
          status: "completed",
          endedAt: session.endedAt,
          duration: session.duration,
        });
      }
    }

    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment?.patientId,
      resourceType: "VideoSession",
      action: "write",
      details: `Telehealth session ended: ${session.id}, duration: ${session.duration}s`,
    });
    res.json(session);
  } catch (error) {
    console.error("[Telehealth] End session error:", error);
    res.status(500).json({ error: "Failed to end session" });
  }
});

router.post("/sessions/:id/join", async (req: Request, res: Response) => {
  try {
    const { userId, userName, role } = req.body;
    
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      existingParticipant.isConnected = true;
      existingParticipant.joinedAt = new Date().toISOString();
      return res.json(existingParticipant);
    }

    const participant: VideoParticipant = {
      id: generateId("part"),
      sessionId: session.id,
      userId,
      userName,
      role,
      joinedAt: new Date().toISOString(),
      isConnected: true,
      audioEnabled: true,
      videoEnabled: true,
    };

    session.participants.push(participant);
    session.updatedAt = new Date().toISOString();

    const apt = appointments.find(a => a.id === session.appointmentId);
    await logPhiAccess({
      userId,
      patientId: apt?.patientId,
      resourceType: "VideoSession",
      action: "write",
      details: `Participant ${userName} (${role}) joined telehealth session ${session.id}`,
    });
    res.json(participant);
  } catch (error) {
    console.error("[Telehealth] Join session error:", error);
    res.status(500).json({ error: "Failed to join session" });
  }
});

router.post("/sessions/:id/leave", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    const session = sessions.find(s => s.id === req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (participant) {
      participant.isConnected = false;
      participant.leftAt = new Date().toISOString();
    }

    session.updatedAt = new Date().toISOString();
    res.json({ success: true });
  } catch (error) {
    console.error("[Telehealth] Leave session error:", error);
    res.status(500).json({ error: "Failed to leave session" });
  }
});

router.get("/patient-context/:patientId", async (req: Request, res: Response) => {
  try {
    const context = samplePatientContexts[req.params.patientId];
    if (!context) {
      return res.status(404).json({ error: "Patient context not found" });
    }

    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: req.params.patientId,
      resourceType: "PatientContext",
      action: "read",
      details: `Patient context accessed during telehealth session`,
    });
    res.json(context);
  } catch (error) {
    console.error("[Telehealth] Get patient context error:", error);
    res.status(500).json({ error: "Failed to get patient context" });
  }
});

router.get("/call-logs", async (req: Request, res: Response) => {
  try {
    const { sessionId, patientId, clinicianId } = req.query;
    let filtered = [...callLogs];

    if (sessionId) filtered = filtered.filter(l => l.sessionId === sessionId);
    if (patientId) filtered = filtered.filter(l => l.patientId === patientId);
    if (clinicianId) filtered = filtered.filter(l => l.clinicianId === clinicianId);

    res.json(filtered);
  } catch (error) {
    console.error("[Telehealth] Get call logs error:", error);
    res.status(500).json({ error: "Failed to get call logs" });
  }
});

router.post("/call-logs", async (req: Request, res: Response) => {
  try {
    const log: VideoCallLog = {
      id: generateId("log"),
      ...req.body,
      createdAt: new Date().toISOString(),
    };

    callLogs.push(log);
    res.status(201).json(log);
  } catch (error) {
    console.error("[Telehealth] Create call log error:", error);
    res.status(500).json({ error: "Failed to create call log" });
  }
});

router.get("/available-slots", async (req: Request, res: Response) => {
  try {
    const { clinicianId, date } = req.query;
    
    const slots = [];
    const baseDate = date ? new Date(date as string) : new Date();
    baseDate.setHours(9, 0, 0, 0);

    for (let i = 0; i < 8; i++) {
      const slotTime = new Date(baseDate.getTime() + i * 3600000);
      const isBooked = appointments.some(a => 
        a.clinicianId === clinicianId &&
        new Date(a.scheduledStartTime).getTime() === slotTime.getTime()
      );

      if (!isBooked) {
        slots.push({
          startTime: slotTime.toISOString(),
          endTime: new Date(slotTime.getTime() + 1800000).toISOString(),
          duration: 30,
          available: true,
        });
      }
    }

    res.json(slots);
  } catch (error) {
    console.error("[Telehealth] Get available slots error:", error);
    res.status(500).json({ error: "Failed to get available slots" });
  }
});

// Session Notes for real-time collaboration
interface SessionNote {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  noteType: "observation" | "question" | "action_item" | "follow_up" | "general";
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

const sessionNotes: SessionNote[] = [];

router.get("/sessions/:sessionId/notes", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { shared } = req.query;
    
    const session = sessions.find(s => s.id === sessionId);
    const apt = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    await logPhiAccess({
      userId: "current-user",
      patientId: apt?.patientId,
      resourceType: "SessionNote",
      action: "read",
      details: `Accessed session notes for telehealth session: ${sessionId}`,
    });
    
    let notes = sessionNotes.filter(n => n.sessionId === sessionId);
    if (shared === "true") {
      notes = notes.filter(n => n.isShared);
    }
    
    notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(notes);
  } catch (error) {
    console.error("[Telehealth] Get session notes error:", error);
    res.status(500).json({ error: "Failed to get session notes" });
  }
});

router.post("/sessions/:sessionId/notes", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { authorId, authorName, authorRole, content, noteType, isShared } = req.body;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const note: SessionNote = {
      id: generateId("note"),
      sessionId,
      authorId: authorId || "current-user",
      authorName: authorName || "Sample User",
      authorRole: authorRole || "provider",
      content,
      noteType: noteType || "general",
      isShared: isShared ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    sessionNotes.push(note);
    
    const apt = appointments.find(a => a.id === session.appointmentId);
    await logPhiAccess({
      userId: authorId || "current-user",
      patientId: apt?.patientId,
      resourceType: "SessionNote",
      action: "write",
      details: `Session note created during telehealth: ${note.id}`,
    });
    
    res.status(201).json(note);
  } catch (error) {
    console.error("[Telehealth] Create session note error:", error);
    res.status(500).json({ error: "Failed to create session note" });
  }
});

router.patch("/sessions/:sessionId/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { sessionId, noteId } = req.params;
    const note = sessionNotes.find(n => n.id === noteId && n.sessionId === sessionId);
    
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    const session = sessions.find(s => s.id === sessionId);
    const apt = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    await logPhiAccess({
      userId: req.body.authorId || "current-user",
      patientId: apt?.patientId,
      resourceType: "SessionNote",
      action: "write",
      details: `Updated session note: ${noteId}`,
    });
    
    const { content, noteType, isShared } = req.body;
    if (content !== undefined) note.content = content;
    if (noteType !== undefined) note.noteType = noteType;
    if (isShared !== undefined) note.isShared = isShared;
    note.updatedAt = new Date().toISOString();
    
    res.json(note);
  } catch (error) {
    console.error("[Telehealth] Update session note error:", error);
    res.status(500).json({ error: "Failed to update session note" });
  }
});

router.delete("/sessions/:sessionId/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { sessionId, noteId } = req.params;
    const index = sessionNotes.findIndex(n => n.id === noteId && n.sessionId === sessionId);
    
    if (index === -1) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    const session = sessions.find(s => s.id === sessionId);
    const apt = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    await logPhiAccess({
      userId: "current-user",
      patientId: apt?.patientId,
      resourceType: "SessionNote",
      action: "delete",
      details: `Deleted session note: ${noteId}`,
    });
    
    sessionNotes.splice(index, 1);
    res.json({ success: true });
  } catch (error) {
    console.error("[Telehealth] Delete session note error:", error);
    res.status(500).json({ error: "Failed to delete session note" });
  }
});

// Document Sharing during telehealth sessions
interface SharedSessionDocument {
  id: string;
  sessionId: string;
  sharedById: string;
  sharedByName: string;
  documentId: string;
  documentName: string;
  documentType: string;
  documentUrl?: string;
  description?: string;
  accessibleToPatient: boolean;
  viewedByPatient: boolean;
  viewedAt?: string;
  createdAt: string;
}

const sharedSessionDocuments: SharedSessionDocument[] = [];

router.get("/sessions/:sessionId/documents", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    const session = sessions.find(s => s.id === sessionId);
    const apt = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    await logPhiAccess({
      userId: "current-user",
      patientId: apt?.patientId,
      resourceType: "SharedDocument",
      action: "read",
      details: `Accessed shared documents for telehealth session: ${sessionId}`,
    });
    
    const docs = sharedSessionDocuments.filter(d => d.sessionId === sessionId);
    docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(docs);
  } catch (error) {
    console.error("[Telehealth] Get shared documents error:", error);
    res.status(500).json({ error: "Failed to get shared documents" });
  }
});

router.post("/sessions/:sessionId/documents", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { sharedById, sharedByName, documentId, documentName, documentType, documentUrl, description, accessibleToPatient } = req.body;
    
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const doc: SharedSessionDocument = {
      id: generateId("shdoc"),
      sessionId,
      sharedById: sharedById || "current-user",
      sharedByName: sharedByName || "Sample Provider",
      documentId: documentId || generateId("doc"),
      documentName,
      documentType,
      documentUrl,
      description,
      accessibleToPatient: accessibleToPatient ?? true,
      viewedByPatient: false,
      createdAt: new Date().toISOString(),
    };
    
    sharedSessionDocuments.push(doc);
    
    const apt = appointments.find(a => a.id === session.appointmentId);
    await logPhiAccess({
      userId: sharedById || "current-user",
      patientId: apt?.patientId,
      resourceType: "SharedDocument",
      action: "write",
      details: `Document shared during telehealth: ${documentName}`,
    });
    
    res.status(201).json(doc);
  } catch (error) {
    console.error("[Telehealth] Share document error:", error);
    res.status(500).json({ error: "Failed to share document" });
  }
});

router.post("/sessions/:sessionId/documents/:docId/view", async (req: Request, res: Response) => {
  try {
    const { sessionId, docId } = req.params;
    const doc = sharedSessionDocuments.find(d => d.id === docId && d.sessionId === sessionId);
    
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }
    
    const session = sessions.find(s => s.id === sessionId);
    const apt = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    await logPhiAccess({
      userId: req.body.viewerId || "patient-default",
      patientId: apt?.patientId,
      resourceType: "SharedDocument",
      action: "read",
      details: `Patient viewed shared document: ${doc.documentName} (${docId})`,
    });
    
    doc.viewedByPatient = true;
    doc.viewedAt = new Date().toISOString();
    
    res.json(doc);
  } catch (error) {
    console.error("[Telehealth] Mark document viewed error:", error);
    res.status(500).json({ error: "Failed to mark document as viewed" });
  }
});

// Calendar view with week/month appointments
router.get("/calendar", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, clinicianId, view } = req.query;
    
    await logPhiAccess({
      userId: "current-user",
      patientId: undefined,
      resourceType: "AppointmentCalendar",
      action: "read",
      details: `Accessed telehealth calendar view: ${view || "default"}, clinician: ${clinicianId || "all"}`,
    });
    
    let start: Date;
    let end: Date;
    
    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      
      if (view === "week") {
        start.setDate(start.getDate() - start.getDay());
        end = new Date(start);
        end.setDate(end.getDate() + 7);
      } else {
        start.setDate(1);
        end = new Date(start);
        end.setMonth(end.getMonth() + 1);
      }
    }
    
    let filtered = appointments.filter(a => {
      const aptDate = new Date(a.scheduledStartTime);
      return aptDate >= start && aptDate < end;
    });
    
    if (clinicianId) {
      filtered = filtered.filter(a => a.clinicianId === clinicianId);
    }
    
    filtered.sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());
    
    const calendarEvents = filtered.map(apt => ({
      id: apt.id,
      title: apt.patientName,
      start: apt.scheduledStartTime,
      end: apt.scheduledEndTime,
      status: apt.status,
      clinicianName: apt.clinicianName,
      reason: apt.reason,
      duration: apt.duration,
      roomId: apt.roomId,
    }));
    
    res.json({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      events: calendarEvents,
      totalAppointments: calendarEvents.length,
    });
  } catch (error) {
    console.error("[Telehealth] Get calendar error:", error);
    res.status(500).json({ error: "Failed to get calendar" });
  }
});

// Dashboard summary
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const todayAppointments = appointments.filter(a => {
      const aptDate = new Date(a.scheduledStartTime);
      return aptDate >= todayStart && aptDate < todayEnd;
    });
    
    const upcomingAppointments = appointments.filter(a => {
      const aptDate = new Date(a.scheduledStartTime);
      return aptDate >= now && a.status === "scheduled";
    }).slice(0, 5);
    
    const activeSessions = sessions.filter(s => s.status === "in_progress");
    
    res.json({
      todayCount: todayAppointments.length,
      scheduledCount: appointments.filter(a => a.status === "scheduled").length,
      completedCount: appointments.filter(a => a.status === "completed").length,
      activeSessionsCount: activeSessions.length,
      upcomingAppointments,
      activeSessions,
    });
  } catch (error) {
    console.error("[Telehealth] Get dashboard error:", error);
    res.status(500).json({ error: "Failed to get dashboard" });
  }
});

// Post-Session Summaries with AI-generated content
interface SessionSummary {
  id: string;
  sessionId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  visitDate: string;
  duration: number;
  chiefComplaint: string;
  diagnosisDiscussed: string[];
  treatmentPlan: string;
  medicationChanges: string[];
  followUpInstructions: string[];
  nextSteps: string[];
  patientQuestions: string[];
  additionalNotes: string;
  sentToPatient: boolean;
  sentAt?: string;
  patientViewed: boolean;
  patientViewedAt?: string;
  noCdsDisclaimer: string;
  createdAt: string;
  updatedAt: string;
}

const sessionSummaries: SessionSummary[] = [];

router.get("/sessions/:sessionId/summary", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    // Support lookup by sessionId OR appointmentId
    let summary = sessionSummaries.find(s => s.sessionId === sessionId);
    if (!summary) {
      summary = sessionSummaries.find(s => s.appointmentId === sessionId);
    }
    
    if (!summary) {
      // Try to find session by ID or by appointmentId
      let session = sessions.find(s => s.id === sessionId);
      if (!session) {
        // Check if sessionId is actually an appointmentId
        const apt = appointments.find(a => a.id === sessionId);
        if (apt) {
          session = sessions.find(s => s.appointmentId === apt.id);
        }
      }
      const appointment = session ? appointments.find(a => a.id === session.appointmentId) : appointments.find(a => a.id === sessionId);
      const notes = session ? sessionNotes.filter(n => n.sessionId === session.id) : [];
      
      if (session && appointment) {
        const generatedSummary: SessionSummary = {
          id: generateId("sum"),
          sessionId,
          appointmentId: session.appointmentId,
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          providerId: appointment.clinicianId,
          providerName: appointment.clinicianName,
          visitDate: session.startedAt || new Date().toISOString(),
          duration: session.duration || 0,
          chiefComplaint: appointment.reason || "General consultation",
          diagnosisDiscussed: [],
          treatmentPlan: "",
          medicationChanges: [],
          followUpInstructions: [
            "Schedule a follow-up appointment in 2-4 weeks if symptoms persist",
            "Contact the office if you experience any concerning symptoms",
            "Continue taking medications as prescribed"
          ],
          nextSteps: [
            "Review any lab work ordered during this visit",
            "Fill new prescriptions at your pharmacy",
            "Complete any referral appointments scheduled"
          ],
          patientQuestions: notes.filter(n => n.noteType === "question").map(n => n.content),
          additionalNotes: notes.filter(n => n.isShared).map(n => n.content).join("\n"),
          sentToPatient: false,
          patientViewed: false,
          noCdsDisclaimer: "This summary is for informational purposes only and does not constitute medical advice. Always follow your healthcare provider's specific instructions and contact them with any questions or concerns.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        sessionSummaries.push(generatedSummary);
        
        await logPhiAccess({
          userId: (req as any).session?.userId || "current-user",
          patientId: appointment.patientId,
          resourceType: "SessionSummary",
          action: "write",
          details: `Generated session summary for telehealth session: ${sessionId}`,
        });
        
        return res.json(generatedSummary);
      }
      
      return res.status(404).json({ error: "Session not found or no data available" });
    }
    
    const session = sessions.find(s => s.id === sessionId);
    const appointment = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment?.patientId,
      resourceType: "SessionSummary",
      action: "read",
      details: `Accessed session summary for telehealth session: ${sessionId}`,
    });
    
    res.json(summary);
  } catch (error) {
    console.error("[Telehealth] Get session summary error:", error);
    res.status(500).json({ error: "Failed to get session summary" });
  }
});

router.post("/sessions/:sessionId/summary/generate", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    let session = sessions.find(s => s.id === sessionId);
    let appointment: VideoAppointment | undefined;

    if (!session) {
      appointment = appointments.find(a => a.id === sessionId);
      if (appointment) {
        session = sessions.find(s => s.appointmentId === appointment!.id);
      }
    } else {
      appointment = appointments.find(a => a.id === session!.appointmentId);
    }

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found for this session" });
    }

    const sessionId_actual = session?.id || sessionId;
    const notes = session ? sessionNotes.filter(n => n.sessionId === session!.id) : [];
    const docs = session ? sharedSessionDocuments.filter(d => d.sessionId === session!.id) : [];

    const context: TelehealthSessionContext = {
      patientName: appointment.patientName,
      providerName: appointment.clinicianName,
      visitDate: session?.startedAt || appointment.scheduledStartTime,
      durationMinutes: session?.duration ? Math.round(session.duration / 60) : appointment.duration,
      chiefComplaint: appointment.reason || "General consultation",
      sessionNotes: notes.map(n => ({
        content: n.content,
        noteType: n.noteType,
        authorName: n.authorName,
        isShared: n.isShared,
      })),
      sharedDocuments: docs.map(d => ({
        documentName: d.documentName,
        documentType: d.documentType,
        description: d.description,
      })),
    };

    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment.patientId,
      resourceType: "SessionSummary",
      action: "write",
      details: `AI-generated session summary for telehealth session: ${sessionId_actual}`,
    });

    const aiSummary = await generateTelehealthSummary(context);

    const existingIndex = sessionSummaries.findIndex(s => s.sessionId === sessionId_actual || s.appointmentId === appointment!.id);

    const summary: SessionSummary = {
      id: existingIndex >= 0 ? sessionSummaries[existingIndex].id : generateId("sum"),
      sessionId: sessionId_actual,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      providerId: appointment.clinicianId,
      providerName: appointment.clinicianName,
      visitDate: session?.startedAt || appointment.scheduledStartTime,
      duration: session?.duration || appointment.duration * 60,
      chiefComplaint: aiSummary.chiefComplaint,
      diagnosisDiscussed: aiSummary.diagnosisDiscussed,
      treatmentPlan: aiSummary.treatmentPlan,
      medicationChanges: aiSummary.medicationChanges,
      followUpInstructions: aiSummary.followUpInstructions,
      nextSteps: aiSummary.nextSteps,
      patientQuestions: aiSummary.patientQuestions,
      additionalNotes: aiSummary.additionalNotes,
      sentToPatient: false,
      patientViewed: false,
      noCdsDisclaimer: aiSummary.noCdsDisclaimer,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      sessionSummaries[existingIndex] = summary;
    } else {
      sessionSummaries.push(summary);
    }

    res.json({ ...summary, aiGenerated: true });
  } catch (error) {
    console.error("[Telehealth] AI summary generation error:", error);
    res.status(500).json({ error: "Failed to generate AI summary. Please try again." });
  }
});

router.patch("/sessions/:sessionId/summary", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const summary = sessionSummaries.find(s => s.sessionId === sessionId);
    
    if (!summary) {
      return res.status(404).json({ error: "Summary not found" });
    }
    
    const session = sessions.find(s => s.id === sessionId);
    const appointment = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    const {
      chiefComplaint,
      diagnosisDiscussed,
      treatmentPlan,
      medicationChanges,
      followUpInstructions,
      nextSteps,
      additionalNotes
    } = req.body;
    
    if (chiefComplaint !== undefined) summary.chiefComplaint = chiefComplaint;
    if (diagnosisDiscussed !== undefined) summary.diagnosisDiscussed = diagnosisDiscussed;
    if (treatmentPlan !== undefined) summary.treatmentPlan = treatmentPlan;
    if (medicationChanges !== undefined) summary.medicationChanges = medicationChanges;
    if (followUpInstructions !== undefined) summary.followUpInstructions = followUpInstructions;
    if (nextSteps !== undefined) summary.nextSteps = nextSteps;
    if (additionalNotes !== undefined) summary.additionalNotes = additionalNotes;
    summary.updatedAt = new Date().toISOString();
    
    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment?.patientId,
      resourceType: "SessionSummary",
      action: "write",
      details: `Updated session summary for telehealth session: ${sessionId}`,
    });
    
    res.json(summary);
  } catch (error) {
    console.error("[Telehealth] Update session summary error:", error);
    res.status(500).json({ error: "Failed to update session summary" });
  }
});

router.post("/sessions/:sessionId/summary/send", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const summary = sessionSummaries.find(s => s.sessionId === sessionId);
    
    if (!summary) {
      return res.status(404).json({ error: "Summary not found" });
    }
    
    summary.sentToPatient = true;
    summary.sentAt = new Date().toISOString();
    summary.updatedAt = new Date().toISOString();
    
    const session = sessions.find(s => s.id === sessionId);
    const appointment = session ? appointments.find(a => a.id === session.appointmentId) : null;
    
    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment?.patientId,
      resourceType: "SessionSummary",
      action: "write",
      details: `Sent session summary to patient for telehealth session: ${sessionId}`,
    });
    
    res.json({ 
      success: true, 
      message: "Summary sent to patient successfully",
      summary 
    });
  } catch (error) {
    console.error("[Telehealth] Send session summary error:", error);
    res.status(500).json({ error: "Failed to send session summary" });
  }
});

router.post("/sessions/:sessionId/summary/patient-view", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const summary = sessionSummaries.find(s => s.sessionId === sessionId);
    
    if (!summary) {
      return res.status(404).json({ error: "Summary not found" });
    }
    
    if (!summary.sentToPatient) {
      return res.status(403).json({ error: "Summary not yet sent to patient" });
    }
    
    summary.patientViewed = true;
    summary.patientViewedAt = new Date().toISOString();
    summary.updatedAt = new Date().toISOString();
    
    await logPhiAccess({
      userId: req.body.patientId || "patient-default",
      patientId: summary.patientId,
      resourceType: "SessionSummary",
      action: "read",
      details: `Patient viewed session summary for telehealth session: ${sessionId}`,
    });
    
    res.json(summary);
  } catch (error) {
    console.error("[Telehealth] Patient view summary error:", error);
    res.status(500).json({ error: "Failed to record patient view" });
  }
});

// Get all summaries for a patient (patient portal view)
router.get("/patient/:patientId/summaries", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    
    const summaries = sessionSummaries.filter(s => 
      s.patientId === patientId && s.sentToPatient
    );
    
    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId,
      resourceType: "SessionSummary",
      action: "read",
      details: `Patient accessed their telehealth session summaries`,
    });
    
    summaries.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());
    
    res.json(summaries);
  } catch (error) {
    console.error("[Telehealth] Get patient summaries error:", error);
    res.status(500).json({ error: "Failed to get patient summaries" });
  }
});

// ============================================================
// Patient Portal: Secure Messaging
// ============================================================

interface PatientMessage {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "provider";
  subject: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  parentMessageId?: string;
  createdAt: string;
}

const patientMessages: PatientMessage[] = [
  {
    id: "msg-001",
    patientId: "patient-001",
    patientName: "John Smith",
    providerId: "clinician-001",
    providerName: "Dr. Sarah Johnson",
    senderId: "clinician-001",
    senderName: "Dr. Sarah Johnson",
    senderRole: "provider",
    subject: "Follow-up on recent lab results",
    content: "Hello John, your recent A1C results came back. I'd like to discuss them at your next appointment. In the meantime, please continue with your current medication regimen.",
    isRead: true,
    readAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "msg-002",
    patientId: "patient-001",
    patientName: "John Smith",
    providerId: "clinician-001",
    providerName: "Dr. Sarah Johnson",
    senderId: "patient-001",
    senderName: "John Smith",
    senderRole: "patient",
    subject: "Re: Follow-up on recent lab results",
    content: "Thank you Dr. Johnson. I have been monitoring my blood sugar levels daily. Should I bring my log to our next visit?",
    isRead: true,
    readAt: new Date(Date.now() - 86400000).toISOString(),
    parentMessageId: "msg-001",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "msg-003",
    patientId: "patient-001",
    patientName: "John Smith",
    providerId: "clinician-001",
    providerName: "Dr. Sarah Johnson",
    senderId: "clinician-001",
    senderName: "Dr. Sarah Johnson",
    senderRole: "provider",
    subject: "Re: Follow-up on recent lab results",
    content: "Yes, please bring your blood sugar log. That will be very helpful for our discussion. See you at your next appointment!",
    isRead: false,
    parentMessageId: "msg-001",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "msg-004",
    patientId: "patient-002",
    patientName: "Emily Davis",
    providerId: "clinician-001",
    providerName: "Dr. Sarah Johnson",
    senderId: "patient-002",
    senderName: "Emily Davis",
    senderRole: "patient",
    subject: "Question about prescription renewal",
    content: "Hi Dr. Johnson, my sertraline prescription is running out next week. Can it be renewed?",
    isRead: true,
    readAt: new Date(Date.now() - 3600000).toISOString(),
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

router.get("/patient/:patientId/messages", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { patientId } = req.params;

    await logPhiAccess({
      userId: (req as any).session?.userId || patientId,
      patientId,
      resourceType: "PatientMessage",
      action: "read",
      details: `Patient accessed their telehealth messages`,
    });

    const messages = patientMessages
      .filter((m) => m.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const threads = new Map<string, PatientMessage[]>();
    for (const msg of messages) {
      const threadId = msg.parentMessageId || msg.id;
      if (!threads.has(threadId)) threads.set(threadId, []);
      threads.get(threadId)!.push(msg);
    }

    const threadList = Array.from(threads.entries()).map(([threadId, msgs]) => {
      msgs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const latest = msgs[msgs.length - 1];
      const root = msgs[0];
      return {
        threadId,
        subject: root.subject.replace(/^Re: /, ""),
        providerName: root.providerName,
        providerId: root.providerId,
        lastMessage: latest.content,
        lastSenderName: latest.senderName,
        lastSenderRole: latest.senderRole,
        lastMessageAt: latest.createdAt,
        unreadCount: msgs.filter((m) => !m.isRead && m.senderRole === "provider").length,
        messageCount: msgs.length,
        messages: msgs,
      };
    });

    threadList.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    res.json(threadList);
  } catch (error) {
    console.error("[Telehealth] Get patient messages error:", error);
    res.status(500).json({ error: "Failed to get patient messages" });
  }
});

router.post("/patient/:patientId/messages", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { patientId } = req.params;
    const { providerId, providerName, subject, content, parentMessageId } = req.body;

    if (!content || !providerId) {
      return res.status(400).json({ error: "Content and providerId are required" });
    }

    const patientContext = samplePatientContexts[patientId];
    const patientName = patientContext?.patientName || "Patient";

    const message: PatientMessage = {
      id: generateId("msg"),
      patientId,
      patientName,
      providerId,
      providerName: providerName || "Provider",
      senderId: patientId,
      senderName: patientName,
      senderRole: "patient",
      subject: subject || (parentMessageId ? "Re: Message" : "New Message"),
      content,
      isRead: false,
      parentMessageId,
      createdAt: new Date().toISOString(),
    };

    patientMessages.push(message);

    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "PatientMessage",
      action: "write",
      details: `Patient sent secure message: ${message.id}`,
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("[Telehealth] Send patient message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/patient/:patientId/messages/:messageId/read", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { patientId, messageId } = req.params;
    const message = patientMessages.find((m) => m.id === messageId && m.patientId === patientId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    message.isRead = true;
    message.readAt = new Date().toISOString();

    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "PatientMessage",
      action: "read",
      details: `Patient read message: ${messageId}`,
    });

    res.json(message);
  } catch (error) {
    console.error("[Telehealth] Mark message read error:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});

// ============================================================
// Patient Portal: AI-Generated Educational Content
// ============================================================

import {
  NO_CDS_POLICY,
  NO_CDS_DISCLAIMER,
  sanitizeNoCDS,
  sanitizeNoCDSObject,
  logNoCDSCompliance,
} from "./security/no-cds-guardrails";

import { generatePhiSafeText } from "./services/ai-gateway";

interface PatientEducationArticle {
  id: string;
  patientId: string;
  title: string;
  summary: string;
  content: string;
  topics: string[];
  readingLevel: string;
  noCdsDisclaimer: string;
  aiGenerated: boolean;
  createdAt: string;
}

const patientEducationArticles: PatientEducationArticle[] = [];

router.get("/patient/:patientId/education", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { patientId } = req.params;

    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "PatientEducation",
      action: "read",
      details: `Patient accessed educational content`,
    });

    const articles = patientEducationArticles
      .filter((a) => a.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json(articles);
  } catch (error) {
    console.error("[Telehealth] Get patient education error:", error);
    res.status(500).json({ error: "Failed to get education content" });
  }
});

router.post("/patient/:patientId/education/generate", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { patientId } = req.params;
    const { topic } = req.body;

    const patientContext = samplePatientContexts[patientId];
    const conditions = patientContext?.conditions || [];
    const medications = patientContext?.medications || [];

    const topicText = topic || (conditions.length > 0 ? conditions[0] : "general wellness");

    const responseText = await generatePhiSafeText({
      system: `You are a health education content writer. ${NO_CDS_POLICY}

Generate patient-friendly educational content about the requested topic.
The patient has the following documented conditions: ${conditions.join(", ") || "none specified"}.
Current documented medications: ${medications.join(", ") || "none specified"}.

Output format (JSON):
{
  "title": "Article title",
  "summary": "2-3 sentence summary",
  "content": "Full educational content in plain language, 3-5 paragraphs",
  "topics": ["topic1", "topic2"],
  "readingLevel": "general"
}

Use only observational and informational language. Never provide medical advice.`,
      user: `Generate educational content about: ${topicText}`,
      responseMimeType: "application/json",
      temperature: 0.7,
      maxTokens: 1200,
    });

    let parsed: any;
    try {
      parsed = JSON.parse(responseText || "{}");
    } catch {
      parsed = {
        title: `Understanding ${topicText}`,
        summary: `Educational overview of ${topicText}.`,
        content: `General educational content about ${topicText}. Please discuss with your care team for personalized information.`,
        topics: [topicText],
        readingLevel: "general",
      };
    }

    const sanitized = sanitizeNoCDSObject(parsed);

    const article: PatientEducationArticle = {
      id: generateId("edu"),
      patientId,
      title: sanitizeNoCDS(sanitized.title || `Understanding ${topicText}`),
      summary: sanitizeNoCDS(sanitized.summary || ""),
      content: sanitizeNoCDS(sanitized.content || "") + `\n\n${NO_CDS_DISCLAIMER}`,
      topics: (sanitized.topics || [topicText]).map((t: string) => sanitizeNoCDS(t)),
      readingLevel: sanitized.readingLevel || "general",
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      aiGenerated: true,
      createdAt: new Date().toISOString(),
    };

    patientEducationArticles.push(article);

    logNoCDSCompliance(
      "PatientTelehealthEducation",
      "generate_education",
      `Generated education content for patient ${patientId} on topic: ${topicText}`,
      `Education article ${article.id} created with NO-CDS compliance`,
    );

    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "PatientEducation",
      action: "write",
      details: `AI-generated education content for topic: ${topicText}`,
    });

    res.status(201).json(article);
  } catch (error) {
    console.error("[Telehealth] Generate education error:", error);
    res.status(500).json({ error: "Failed to generate educational content" });
  }
});

// Patient portal dashboard
router.get("/patient/:patientId/portal-dashboard", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { patientId } = req.params;

    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "PatientPortalDashboard",
      action: "read",
      details: `Patient accessed telehealth portal dashboard`,
    });

    const now = new Date();
    const patientAppts = appointments.filter((a) => a.patientId === patientId || patientId === "patient-001");

    const upcoming = patientAppts
      .filter((a) => new Date(a.scheduledStartTime) >= now && (a.status === "scheduled" || a.status === "in_progress"))
      .sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());

    const past = patientAppts
      .filter((a) => a.status === "completed" || a.status === "cancelled" || new Date(a.scheduledStartTime) < now)
      .sort((a, b) => new Date(b.scheduledStartTime).getTime() - new Date(a.scheduledStartTime).getTime());

    const summaries = sessionSummaries
      .filter((s) => s.patientId === patientId || patientId === "patient-001")
      .sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

    const messages = patientMessages.filter((m) => m.patientId === patientId || patientId === "patient-001");
    const unreadMessages = messages.filter((m) => !m.isRead && m.senderRole === "provider").length;

    const educationCount = patientEducationArticles.filter((a) => a.patientId === patientId).length;

    res.json({
      upcomingVisits: upcoming,
      pastVisits: past,
      summaries,
      unreadMessages,
      totalMessages: messages.length,
      educationArticles: educationCount,
      nextAppointment: upcoming[0] || null,
    });
  } catch (error) {
    console.error("[Telehealth] Patient portal dashboard error:", error);
    res.status(500).json({ error: "Failed to load patient portal" });
  }
});

// ============================================================
// Unified Patient Record - Longitudinal Health Journey
// ============================================================

interface UnifiedTimelineEvent {
  id: string;
  category: "appointment" | "message" | "medication" | "condition" | "vital" | "allergy" | "summary" | "education" | "lab_result";
  title: string;
  description: string;
  date: string;
  provider?: string;
  status?: string;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, any>;
}

const labResults = [
  {
    id: "lab-001",
    patientId: "patient-001",
    testName: "HbA1c",
    value: "7.2%",
    referenceRange: "4.0-5.6%",
    status: "Above Normal",
    orderedBy: "Dr. Sarah Johnson",
    date: new Date(Date.now() - 86400000 * 14).toISOString(),
    category: "Endocrine",
  },
  {
    id: "lab-002",
    patientId: "patient-001",
    testName: "Complete Blood Count (CBC)",
    value: "Within Normal Limits",
    referenceRange: "N/A",
    status: "Normal",
    orderedBy: "Dr. Sarah Johnson",
    date: new Date(Date.now() - 86400000 * 14).toISOString(),
    category: "Hematology",
  },
  {
    id: "lab-003",
    patientId: "patient-001",
    testName: "Lipid Panel - LDL",
    value: "142 mg/dL",
    referenceRange: "<100 mg/dL",
    status: "Above Normal",
    orderedBy: "Dr. Sarah Johnson",
    date: new Date(Date.now() - 86400000 * 30).toISOString(),
    category: "Cardiovascular",
  },
  {
    id: "lab-004",
    patientId: "patient-001",
    testName: "Fasting Blood Glucose",
    value: "142 mg/dL",
    referenceRange: "70-100 mg/dL",
    status: "Above Normal",
    orderedBy: "Dr. Sarah Johnson",
    date: new Date(Date.now() - 86400000 * 45).toISOString(),
    category: "Endocrine",
  },
  {
    id: "lab-005",
    patientId: "patient-001",
    testName: "Basic Metabolic Panel",
    value: "Within Normal Limits",
    referenceRange: "N/A",
    status: "Normal",
    orderedBy: "Dr. Michael Chen",
    date: new Date(Date.now() - 86400000 * 60).toISOString(),
    category: "General",
  },
];

router.get("/patient/:patientId/unified-record", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;
    const { patientId } = req.params;
    const { search, categories, startDate, endDate, severity } = req.query;

    await logPhiAccess({
      userId,
      patientId,
      resourceType: "UnifiedPatientRecord",
      action: "read",
      details: `User accessed unified longitudinal health record for patient ${patientId}`,
    });

    const events: UnifiedTimelineEvent[] = [];
    const resolvedPatientId = samplePatientContexts[patientId] ? patientId : "patient-001";
    const context = samplePatientContexts[resolvedPatientId];

    const patientAppts = appointments.filter((a) => a.patientId === resolvedPatientId);
    for (const apt of patientAppts) {
      events.push({
        id: `evt-apt-${apt.id}`,
        category: "appointment",
        title: `${apt.status === "completed" ? "Completed" : apt.status === "cancelled" ? "Cancelled" : "Scheduled"} Visit - ${apt.clinicianName}`,
        description: apt.reason,
        date: apt.scheduledStartTime,
        provider: apt.clinicianName,
        status: apt.status,
        severity: "info",
        metadata: { appointmentId: apt.id, duration: apt.duration },
      });
    }

    if (context.conditions) {
      for (let i = 0; i < context.conditions.length; i++) {
        const condition = context.conditions[i];
        events.push({
          id: `evt-cond-${i}`,
          category: "condition",
          title: `Diagnosis: ${condition}`,
          description: `Active condition documented in patient record`,
          date: new Date(Date.now() - 86400000 * (90 + i * 30)).toISOString(),
          severity: condition.includes("Diabetes") || condition.includes("Hypertension") ? "warning" : "info",
          metadata: { condition },
        });
      }
    }

    if (context.medications) {
      for (let i = 0; i < context.medications.length; i++) {
        const med = context.medications[i];
        events.push({
          id: `evt-med-${i}`,
          category: "medication",
          title: `Medication: ${med}`,
          description: `Active prescription in current regimen`,
          date: new Date(Date.now() - 86400000 * (60 + i * 15)).toISOString(),
          severity: "info",
          metadata: { medication: med },
        });
      }
    }

    if (context.allergies) {
      for (let i = 0; i < context.allergies.length; i++) {
        const allergy = context.allergies[i];
        if (allergy === "None known") continue;
        events.push({
          id: `evt-allergy-${i}`,
          category: "allergy",
          title: `Allergy: ${allergy}`,
          description: `Documented allergy - avoid exposure`,
          date: new Date(Date.now() - 86400000 * (180 + i * 30)).toISOString(),
          severity: "critical",
          metadata: { allergy },
        });
      }
    }

    if (context.vitalSigns) {
      for (let i = 0; i < context.vitalSigns.length; i++) {
        const vital = context.vitalSigns[i];
        events.push({
          id: `evt-vital-${i}`,
          category: "vital",
          title: `${vital.type}: ${vital.value}`,
          description: `Vital sign recorded during visit`,
          date: new Date(vital.date).toISOString(),
          provider: context.recentVisits?.[0]?.provider,
          severity: vital.type === "Blood Glucose" && parseFloat(vital.value) > 140 ? "warning" : "info",
          metadata: { type: vital.type, value: vital.value },
        });
      }
    }

    const patientLabs = labResults.filter((l) => l.patientId === resolvedPatientId);
    for (const lab of patientLabs) {
      events.push({
        id: `evt-lab-${lab.id}`,
        category: "lab_result",
        title: `Lab: ${lab.testName}`,
        description: `Result: ${lab.value} (Ref: ${lab.referenceRange}) - ${lab.status}`,
        date: lab.date,
        provider: lab.orderedBy,
        severity: lab.status === "Above Normal" ? "warning" : "info",
        metadata: { testName: lab.testName, value: lab.value, referenceRange: lab.referenceRange, status: lab.status, category: lab.category },
      });
    }

    const msgs = patientMessages.filter((m) => m.patientId === resolvedPatientId);
    const rootMessages = msgs.filter((m) => !m.parentMessageId);
    for (const msg of rootMessages) {
      const threadCount = msgs.filter((m) => m.parentMessageId === msg.id).length;
      events.push({
        id: `evt-msg-${msg.id}`,
        category: "message",
        title: `Message: ${msg.subject}`,
        description: msg.content.substring(0, 150) + (msg.content.length > 150 ? "..." : ""),
        date: msg.createdAt,
        provider: msg.providerName,
        severity: "info",
        metadata: { messageId: msg.id, threadCount, from: msg.senderName, unread: !msg.isRead },
      });
    }

    const summaries = sessionSummaries.filter((s) => s.patientId === resolvedPatientId);
    for (const sum of summaries) {
      events.push({
        id: `evt-sum-${sum.id}`,
        category: "summary",
        title: `Visit Summary: ${sum.chiefComplaint}`,
        description: `${sum.diagnosisDiscussed.join(", ")} - ${sum.treatmentPlan.substring(0, 100)}`,
        date: sum.visitDate,
        provider: sum.providerName,
        severity: "info",
        metadata: { summaryId: sum.id, medications: sum.medicationChanges, followUp: sum.followUpInstructions },
      });
    }

    const education = patientEducationArticles.filter((a) => a.patientId === resolvedPatientId);
    for (const article of education) {
      events.push({
        id: `evt-edu-${article.id}`,
        category: "education",
        title: `Education: ${article.title}`,
        description: article.summary.substring(0, 150) + (article.summary.length > 150 ? "..." : ""),
        date: article.createdAt,
        severity: "info",
        metadata: { articleId: article.id, topics: article.topics, aiGenerated: article.aiGenerated },
      });
    }

    let filtered = events;

    if (search && typeof search === "string" && search.trim()) {
      const term = search.toLowerCase();
      filtered = filtered.filter((e) =>
        e.title.toLowerCase().includes(term) ||
        e.description.toLowerCase().includes(term) ||
        (e.provider && e.provider.toLowerCase().includes(term))
      );
    }

    if (categories && typeof categories === "string") {
      const cats = categories.split(",");
      filtered = filtered.filter((e) => cats.includes(e.category));
    }

    if (startDate && typeof startDate === "string") {
      const start = new Date(startDate);
      filtered = filtered.filter((e) => new Date(e.date) >= start);
    }
    if (endDate && typeof endDate === "string") {
      const end = new Date(endDate);
      filtered = filtered.filter((e) => new Date(e.date) <= end);
    }

    if (severity && typeof severity === "string") {
      filtered = filtered.filter((e) => e.severity === severity);
    }

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const categoryCounts: Record<string, number> = {};
    for (const e of events) {
      categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
    }

    res.json({
      events: filtered,
      totalCount: events.length,
      filteredCount: filtered.length,
      categoryCounts,
      patient: {
        id: context.patientId,
        name: context.patientName,
        dateOfBirth: context.dateOfBirth,
      },
    });
  } catch (error) {
    console.error("[Telehealth] Unified patient record error:", error);
    res.status(500).json({ error: "Failed to load unified patient record" });
  }
});

// ============================================================
// Session Recording Management
// ============================================================

import type { SessionRecording } from "@shared/schema";
import { insertSessionRecordingSchema } from "@shared/schema";

const sessionRecordings: SessionRecording[] = [];

router.post("/sessions/:sessionId/recordings", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const validated = insertSessionRecordingSchema.parse(req.body);

    const recording: SessionRecording = {
      id: generateId("rec"),
      ...validated,
      objectKey: "",
      encryptionStatus: "encrypted",
      status: "recording",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessionRecordings.push(recording);

    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      session.recordingEnabled = true;
    }

    const appointment = session ? appointments.find(a => a.id === session.appointmentId) : null;
    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment?.patientId,
      resourceType: "SessionRecording",
      action: "write",
      details: `Recording started for session: ${sessionId}, consent from: ${validated.consentedBy.join(", ")}`,
    });

    res.status(201).json(recording);
  } catch (error) {
    console.error("[Telehealth] Create recording error:", error);
    res.status(400).json({ error: "Failed to create recording" });
  }
});

router.post("/recordings/:recordingId/upload", async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const recording = sessionRecordings.find(r => r.id === recordingId);
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const fileBuffer = Buffer.concat(chunks);
        const objectKey = `${process.env.PRIVATE_OBJECT_DIR}/recordings/${recording.sessionId}/${recording.id}.webm`;

        const { Client } = await import("@replit/object-storage");
        const client = new Client();
        await client.uploadFromBytes(objectKey, fileBuffer);

        recording.objectKey = objectKey;
        recording.fileSizeBytes = fileBuffer.length;
        recording.status = "completed";
        recording.updatedAt = new Date().toISOString();

        const session = sessions.find(s => s.id === recording.sessionId);
        if (session) {
          session.recordingUrl = objectKey;
        }

        await logPhiAccess({
          userId: (req as any).session?.userId || "current-user",
          patientId: undefined,
          resourceType: "SessionRecording",
          action: "write",
          details: `Recording uploaded: ${recording.id}, size: ${fileBuffer.length} bytes, stored at: ${objectKey}`,
        });

        res.json(recording);
      } catch (uploadError) {
        console.error("[Telehealth] Upload error:", uploadError);
        recording.status = "failed";
        recording.updatedAt = new Date().toISOString();
        res.status(500).json({ error: "Failed to upload recording" });
      }
    });
  } catch (error) {
    console.error("[Telehealth] Recording upload error:", error);
    res.status(500).json({ error: "Failed to process recording upload" });
  }
});

router.get("/sessions/:sessionId/recordings", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const recordings = sessionRecordings.filter(r => r.sessionId === sessionId);

    const session = sessions.find(s => s.id === sessionId);
    const appointment = session ? appointments.find(a => a.id === session.appointmentId) : null;

    await logPhiAccess({
      userId: (req as any).session?.userId || "current-user",
      patientId: appointment?.patientId,
      resourceType: "SessionRecording",
      action: "read",
      details: `Recording metadata accessed for session: ${sessionId}`,
    });

    res.json(recordings);
  } catch (error) {
    console.error("[Telehealth] Get recordings error:", error);
    res.status(500).json({ error: "Failed to get recordings" });
  }
});

router.patch("/recordings/:recordingId", async (req: Request, res: Response) => {
  try {
    const { recordingId } = req.params;
    const recording = sessionRecordings.find(r => r.id === recordingId);
    if (!recording) {
      return res.status(404).json({ error: "Recording not found" });
    }

    const { status, durationSeconds } = req.body;
    if (status) recording.status = status;
    if (durationSeconds !== undefined) recording.durationSeconds = durationSeconds;
    recording.updatedAt = new Date().toISOString();

    res.json(recording);
  } catch (error) {
    console.error("[Telehealth] Update recording error:", error);
    res.status(500).json({ error: "Failed to update recording" });
  }
});

// ============================================================
// Appointment Reminder Management
// ============================================================

reminderService.startScheduler(appointments);

router.get("/reminder-preferences/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const prefs = reminderService.getPreferences(userId);
    if (!prefs) {
      return res.json({
        userId,
        userRole: "patient",
        channels: ["in_app"],
        timings: ["1_hour"],
        enabled: true,
      });
    }
    res.json(prefs);
  } catch (error) {
    console.error("[Telehealth] Get reminder preferences error:", error);
    res.status(500).json({ error: "Failed to get reminder preferences" });
  }
});

router.put("/reminder-preferences", async (req: Request, res: Response) => {
  try {
    const validated = insertTelehealthReminderPreferenceSchema.parse(req.body);
    const prefs = reminderService.upsertPreferences(validated);

    await logPhiAccess({
      userId: validated.userId,
      resourceType: "ReminderPreference",
      action: "write",
      details: `Reminder preferences updated: channels=${validated.channels.join(",")}, timings=${validated.timings.join(",")}`,
    });

    res.json(prefs);
  } catch (error) {
    console.error("[Telehealth] Update reminder preferences error:", error);
    res.status(400).json({ error: "Failed to update reminder preferences" });
  }
});

router.post("/appointments/:appointmentId/reminders/generate", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const generated = reminderService.generateRemindersForAppointment(appointment);
    res.json({ generated: generated.length, reminders: generated });
  } catch (error) {
    console.error("[Telehealth] Generate reminders error:", error);
    res.status(500).json({ error: "Failed to generate reminders" });
  }
});

router.get("/reminders", async (req: Request, res: Response) => {
  try {
    const { appointmentId, recipientId, status } = req.query;
    const reminders = reminderService.getReminders({
      appointmentId: appointmentId as string,
      recipientId: recipientId as string,
      status: status as string,
    });
    res.json(reminders);
  } catch (error) {
    console.error("[Telehealth] Get reminders error:", error);
    res.status(500).json({ error: "Failed to get reminders" });
  }
});

router.patch("/reminders/:reminderId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { reminderId } = req.params;
    const reminder = reminderService.acknowledgeReminder(reminderId);
    if (!reminder) {
      return res.status(404).json({ error: "Reminder not found" });
    }
    res.json(reminder);
  } catch (error) {
    console.error("[Telehealth] Acknowledge reminder error:", error);
    res.status(500).json({ error: "Failed to acknowledge reminder" });
  }
});

router.post("/reminders/send-now", async (req: Request, res: Response) => {
  try {
    const { appointmentId, recipientId, recipientRole, recipientName, channel } = req.body;
    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    const reminder = reminderService.triggerImmediateReminder(
      appointment,
      recipientId,
      recipientRole,
      recipientName,
      channel || "in_app"
    );
    res.json(reminder);
  } catch (error) {
    console.error("[Telehealth] Send immediate reminder error:", error);
    res.status(500).json({ error: "Failed to send reminder" });
  }
});

router.delete("/appointments/:appointmentId/reminders", async (req: Request, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const cancelled = reminderService.cancelRemindersForAppointment(appointmentId);
    res.json({ cancelled });
  } catch (error) {
    console.error("[Telehealth] Cancel reminders error:", error);
    res.status(500).json({ error: "Failed to cancel reminders" });
  }
});

router.get("/notifications/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const unreadOnly = req.query.unreadOnly === "true";
    const notifications = reminderService.getNotifications(userId, unreadOnly);
    res.json(notifications);
  } catch (error) {
    console.error("[Telehealth] Get notifications error:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

router.patch("/notifications/:notificationId/read", async (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const notification = reminderService.markNotificationRead(notificationId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json(notification);
  } catch (error) {
    console.error("[Telehealth] Mark notification read error:", error);
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

router.post("/notifications/:userId/read-all", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const count = reminderService.markAllNotificationsRead(userId);
    res.json({ markedRead: count });
  } catch (error) {
    console.error("[Telehealth] Mark all notifications read error:", error);
    res.status(500).json({ error: "Failed to mark all notifications read" });
  }
});

router.get("/reminders/stats", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const stats = reminderService.getStats(userId as string);
    res.json(stats);
  } catch (error) {
    console.error("[Telehealth] Get reminder stats error:", error);
    res.status(500).json({ error: "Failed to get reminder stats" });
  }
});

router.post("/reminders/process", async (req: Request, res: Response) => {
  try {
    const sent = reminderService.processScheduledReminders();
    res.json({ processed: sent.length, reminders: sent });
  } catch (error) {
    console.error("[Telehealth] Process reminders error:", error);
    res.status(500).json({ error: "Failed to process reminders" });
  }
});

export default router;
