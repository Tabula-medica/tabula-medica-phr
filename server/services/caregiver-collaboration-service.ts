import crypto from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, patientId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CaregiverCollaboration] ${action} - User:${hashIdentifier(userId)} - Patient:${hashIdentifier(patientId)} - ${details}`);
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskCategory = "medication" | "appointment" | "hygiene" | "nutrition" | "exercise" | "monitoring" | "transportation" | "companionship" | "other";

export interface CareTask {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  createdByName: string;
  dueDate?: string;
  dueTime?: string;
  recurring?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    endDate?: string;
  };
  completedAt?: string;
  completedBy?: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SharedNote {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  category: "general" | "medical" | "behavioral" | "dietary" | "medication" | "emergency" | "handoff";
  isPinned: boolean;
  visibility: "all_caregivers" | "primary_only" | "specific";
  visibleTo?: string[];
  reactions: { userId: string; userName: string; reaction: string }[];
  comments: SharedNoteComment[];
  createdAt: string;
  updatedAt: string;
}

export interface SharedNoteComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  patientId: string;
  title: string;
  description?: string;
  eventType: "appointment" | "medication" | "task" | "shift" | "reminder" | "other";
  startTime: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  assignedTo?: string;
  assignedToName?: string;
  createdBy: string;
  createdByName: string;
  recurring?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    endDate?: string;
  };
  reminders: { minutesBefore: number; notifyVia: ("email" | "push" | "sms")[] }[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaregiverShift {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  startTime: string;
  endTime: string;
  shiftType: "morning" | "afternoon" | "evening" | "overnight" | "full_day";
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  handoffNotes?: string;
  createdAt: string;
}

const careTasks: Map<string, CareTask> = new Map();
const sharedNotes: Map<string, SharedNote> = new Map();
const calendarEvents: Map<string, CalendarEvent> = new Map();
const caregiverShifts: Map<string, CaregiverShift> = new Map();

function initializeSampleData() {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const task1: CareTask = {
    id: "task-sample-001",
    patientId: "patient-001",
    title: "Administer morning medications",
    description: "Give blood pressure and diabetes medications with breakfast",
    category: "medication",
    priority: "high",
    status: "pending",
    assignedTo: "caregiver-001",
    assignedToName: "Michael Johnson",
    createdBy: "caregiver-002",
    createdByName: "Sarah Smith",
    dueDate: tomorrow.toISOString().split("T")[0],
    dueTime: "08:00",
    recurring: { frequency: "daily", interval: 1 },
    notes: ["Patient prefers to take with orange juice"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const task2: CareTask = {
    id: "task-sample-002",
    patientId: "patient-001",
    title: "Physical therapy exercises",
    description: "Assist with leg strengthening exercises as prescribed",
    category: "exercise",
    priority: "medium",
    status: "pending",
    assignedTo: "caregiver-002",
    assignedToName: "Sarah Smith",
    createdBy: "caregiver-001",
    createdByName: "Michael Johnson",
    dueDate: tomorrow.toISOString().split("T")[0],
    dueTime: "14:00",
    notes: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const task3: CareTask = {
    id: "task-sample-003",
    patientId: "patient-001",
    title: "Grocery shopping",
    description: "Buy weekly groceries including diabetic-friendly options",
    category: "nutrition",
    priority: "low",
    status: "pending",
    createdBy: "caregiver-001",
    createdByName: "Michael Johnson",
    dueDate: nextWeek.toISOString().split("T")[0],
    notes: ["Check for low sodium options"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  careTasks.set(task1.id, task1);
  careTasks.set(task2.id, task2);
  careTasks.set(task3.id, task3);

  const note1: SharedNote = {
    id: "note-sample-001",
    patientId: "patient-001",
    authorId: "caregiver-001",
    authorName: "Michael Johnson",
    title: "Evening routine update",
    content: "Mom has been having trouble sleeping. Doctor suggested warm milk before bed and reducing screen time after 8 PM.",
    category: "general",
    isPinned: true,
    visibility: "all_caregivers",
    reactions: [{ userId: "caregiver-002", userName: "Sarah", reaction: "thumbs_up" }],
    comments: [
      {
        id: "comment-001",
        authorId: "caregiver-002",
        authorName: "Sarah Smith",
        content: "I'll make sure to follow this during my evening shifts.",
        createdAt: now.toISOString(),
      },
    ],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const note2: SharedNote = {
    id: "note-sample-002",
    patientId: "patient-001",
    authorId: "caregiver-002",
    authorName: "Sarah Smith",
    title: "Medication side effects observed",
    content: "Noticed mild dizziness after the new blood pressure medication. Will monitor and report to doctor if it continues.",
    category: "medical",
    isPinned: false,
    visibility: "all_caregivers",
    reactions: [],
    comments: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  sharedNotes.set(note1.id, note1);
  sharedNotes.set(note2.id, note2);

  const event1: CalendarEvent = {
    id: "event-sample-001",
    patientId: "patient-001",
    title: "Cardiology appointment",
    description: "Follow-up with Dr. Williams for heart health check",
    eventType: "appointment",
    startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
    allDay: false,
    location: "Heart Care Clinic, 123 Medical Center Dr",
    assignedTo: "caregiver-001",
    assignedToName: "Michael Johnson",
    createdBy: "caregiver-002",
    createdByName: "Sarah Smith",
    reminders: [{ minutesBefore: 60, notifyVia: ["push", "email"] }],
    color: "#ef4444",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const event2: CalendarEvent = {
    id: "event-sample-002",
    patientId: "patient-001",
    title: "Physical therapy session",
    description: "Weekly PT session for mobility improvement",
    eventType: "appointment",
    startTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
    allDay: false,
    location: "Rehab Center",
    createdBy: "caregiver-001",
    createdByName: "Michael Johnson",
    reminders: [{ minutesBefore: 120, notifyVia: ["push"] }],
    color: "#22c55e",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  calendarEvents.set(event1.id, event1);
  calendarEvents.set(event2.id, event2);

  const shift1: CaregiverShift = {
    id: "shift-sample-001",
    patientId: "patient-001",
    caregiverId: "caregiver-001",
    caregiverName: "Michael Johnson",
    startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(8, 0, 0, 0).toString(),
    endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(16, 0, 0, 0).toString(),
    shiftType: "morning",
    status: "scheduled",
    createdAt: now.toISOString(),
  };

  const shift2: CaregiverShift = {
    id: "shift-sample-002",
    patientId: "patient-001",
    caregiverId: "caregiver-002",
    caregiverName: "Sarah Smith",
    startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(16, 0, 0, 0).toString(),
    endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).setHours(22, 0, 0, 0).toString(),
    shiftType: "evening",
    status: "scheduled",
    createdAt: now.toISOString(),
  };

  caregiverShifts.set(shift1.id, shift1);
  caregiverShifts.set(shift2.id, shift2);
}

initializeSampleData();

export function createTask(
  patientId: string,
  createdBy: string,
  createdByName: string,
  task: Omit<CareTask, "id" | "patientId" | "createdBy" | "createdByName" | "createdAt" | "updatedAt" | "notes">
): CareTask {
  const id = generateId("task");
  const now = new Date().toISOString();

  const newTask: CareTask = {
    ...task,
    id,
    patientId,
    createdBy,
    createdByName,
    notes: [],
    createdAt: now,
    updatedAt: now,
  };

  careTasks.set(id, newTask);
  logHipaaAudit("CREATE_TASK", createdBy, patientId, `Created task: ${task.title}`);

  return newTask;
}

export function getPatientTasks(patientId: string, filters?: { status?: TaskStatus; assignedTo?: string; category?: TaskCategory }): CareTask[] {
  const tasks = Array.from(careTasks.values()).filter(t => t.patientId === patientId);

  let filtered = tasks;
  if (filters?.status) {
    filtered = filtered.filter(t => t.status === filters.status);
  }
  if (filters?.assignedTo) {
    filtered = filtered.filter(t => t.assignedTo === filters.assignedTo);
  }
  if (filters?.category) {
    filtered = filtered.filter(t => t.category === filters.category);
  }

  return filtered.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function updateTaskStatus(taskId: string, userId: string, status: TaskStatus, notes?: string): CareTask | undefined {
  const task = careTasks.get(taskId);
  if (!task) return undefined;

  task.status = status;
  task.updatedAt = new Date().toISOString();

  if (status === "completed") {
    task.completedAt = new Date().toISOString();
    task.completedBy = userId;
  }

  if (notes) {
    task.notes.push(`[${new Date().toLocaleDateString()}] ${notes}`);
  }

  logHipaaAudit("UPDATE_TASK", userId, task.patientId, `Updated task ${taskId} status to ${status}`);
  return task;
}

export function assignTask(taskId: string, assignedTo: string, assignedToName: string, assignedBy: string): CareTask | undefined {
  const task = careTasks.get(taskId);
  if (!task) return undefined;

  task.assignedTo = assignedTo;
  task.assignedToName = assignedToName;
  task.updatedAt = new Date().toISOString();
  task.notes.push(`[${new Date().toLocaleDateString()}] Assigned to ${assignedToName}`);

  logHipaaAudit("ASSIGN_TASK", assignedBy, task.patientId, `Assigned task ${taskId} to ${assignedToName}`);
  return task;
}

export function addTaskNote(taskId: string, userId: string, userName: string, note: string): CareTask | undefined {
  const task = careTasks.get(taskId);
  if (!task) return undefined;

  task.notes.push(`[${new Date().toLocaleDateString()}] ${userName}: ${note}`);
  task.updatedAt = new Date().toISOString();

  return task;
}

export function createSharedNote(
  patientId: string,
  authorId: string,
  authorName: string,
  note: Omit<SharedNote, "id" | "patientId" | "authorId" | "authorName" | "reactions" | "comments" | "createdAt" | "updatedAt">
): SharedNote {
  const id = generateId("note");
  const now = new Date().toISOString();

  const newNote: SharedNote = {
    ...note,
    id,
    patientId,
    authorId,
    authorName,
    reactions: [],
    comments: [],
    createdAt: now,
    updatedAt: now,
  };

  sharedNotes.set(id, newNote);
  logHipaaAudit("CREATE_SHARED_NOTE", authorId, patientId, `Created shared note: ${note.title}`);

  return newNote;
}

export function getPatientSharedNotes(patientId: string, caregiverId: string): SharedNote[] {
  const notes = Array.from(sharedNotes.values())
    .filter(n => n.patientId === patientId)
    .filter(n => {
      if (n.visibility === "all_caregivers") return true;
      if (n.visibility === "specific" && n.visibleTo?.includes(caregiverId)) return true;
      if (n.authorId === caregiverId) return true;
      return false;
    });

  return notes.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function addNoteComment(noteId: string, authorId: string, authorName: string, content: string): SharedNote | undefined {
  const note = sharedNotes.get(noteId);
  if (!note) return undefined;

  const comment: SharedNoteComment = {
    id: generateId("comment"),
    authorId,
    authorName,
    content,
    createdAt: new Date().toISOString(),
  };

  note.comments.push(comment);
  note.updatedAt = new Date().toISOString();

  return note;
}

export function addNoteReaction(noteId: string, userId: string, userName: string, reaction: string): SharedNote | undefined {
  const note = sharedNotes.get(noteId);
  if (!note) return undefined;

  const existingReaction = note.reactions.findIndex(r => r.userId === userId);
  if (existingReaction >= 0) {
    note.reactions[existingReaction].reaction = reaction;
  } else {
    note.reactions.push({ userId, userName, reaction });
  }

  note.updatedAt = new Date().toISOString();
  return note;
}

export function toggleNotePin(noteId: string, userId: string): SharedNote | undefined {
  const note = sharedNotes.get(noteId);
  if (!note) return undefined;

  note.isPinned = !note.isPinned;
  note.updatedAt = new Date().toISOString();

  logHipaaAudit("TOGGLE_PIN", userId, note.patientId, `${note.isPinned ? "Pinned" : "Unpinned"} note ${noteId}`);
  return note;
}

export function createCalendarEvent(
  patientId: string,
  createdBy: string,
  createdByName: string,
  event: Omit<CalendarEvent, "id" | "patientId" | "createdBy" | "createdByName" | "createdAt" | "updatedAt">
): CalendarEvent {
  const id = generateId("event");
  const now = new Date().toISOString();

  const newEvent: CalendarEvent = {
    ...event,
    id,
    patientId,
    createdBy,
    createdByName,
    createdAt: now,
    updatedAt: now,
  };

  calendarEvents.set(id, newEvent);
  logHipaaAudit("CREATE_EVENT", createdBy, patientId, `Created calendar event: ${event.title}`);

  return newEvent;
}

export function getPatientCalendarEvents(patientId: string, startDate?: string, endDate?: string): CalendarEvent[] {
  let events = Array.from(calendarEvents.values()).filter(e => e.patientId === patientId);

  if (startDate) {
    events = events.filter(e => new Date(e.startTime) >= new Date(startDate));
  }
  if (endDate) {
    events = events.filter(e => new Date(e.startTime) <= new Date(endDate));
  }

  return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function updateCalendarEvent(eventId: string, userId: string, updates: Partial<CalendarEvent>): CalendarEvent | undefined {
  const event = calendarEvents.get(eventId);
  if (!event) return undefined;

  Object.assign(event, updates, { updatedAt: new Date().toISOString() });
  logHipaaAudit("UPDATE_EVENT", userId, event.patientId, `Updated calendar event ${eventId}`);

  return event;
}

export function deleteCalendarEvent(eventId: string, userId: string): boolean {
  const event = calendarEvents.get(eventId);
  if (!event) return false;

  logHipaaAudit("DELETE_EVENT", userId, event.patientId, `Deleted calendar event ${eventId}`);
  return calendarEvents.delete(eventId);
}

export function createCaregiverShift(
  patientId: string,
  caregiverId: string,
  caregiverName: string,
  shift: Omit<CaregiverShift, "id" | "patientId" | "caregiverId" | "caregiverName" | "createdAt">
): CaregiverShift {
  const id = generateId("shift");

  const newShift: CaregiverShift = {
    ...shift,
    id,
    patientId,
    caregiverId,
    caregiverName,
    createdAt: new Date().toISOString(),
  };

  caregiverShifts.set(id, newShift);
  logHipaaAudit("CREATE_SHIFT", caregiverId, patientId, `Created shift: ${shift.shiftType}`);

  return newShift;
}

export function getPatientShifts(patientId: string, startDate?: string, endDate?: string): CaregiverShift[] {
  let shifts = Array.from(caregiverShifts.values()).filter(s => s.patientId === patientId);

  if (startDate) {
    shifts = shifts.filter(s => new Date(parseInt(s.startTime)) >= new Date(startDate));
  }
  if (endDate) {
    shifts = shifts.filter(s => new Date(parseInt(s.startTime)) <= new Date(endDate));
  }

  return shifts.sort((a, b) => parseInt(a.startTime) - parseInt(b.startTime));
}

export function updateShiftStatus(shiftId: string, status: CaregiverShift["status"], handoffNotes?: string): CaregiverShift | undefined {
  const shift = caregiverShifts.get(shiftId);
  if (!shift) return undefined;

  shift.status = status;
  if (handoffNotes) {
    shift.handoffNotes = handoffNotes;
  }

  return shift;
}

export function getCollaborationSummary(patientId: string): {
  pendingTasks: number;
  overdueTasks: number;
  upcomingEvents: number;
  activeShifts: number;
  recentNotes: number;
} {
  const now = new Date();
  const tasks = Array.from(careTasks.values()).filter(t => t.patientId === patientId);
  const events = Array.from(calendarEvents.values()).filter(e => e.patientId === patientId);
  const shifts = Array.from(caregiverShifts.values()).filter(s => s.patientId === patientId);
  const notes = Array.from(sharedNotes.values()).filter(n => n.patientId === patientId);

  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length;
  const overdueTasks = tasks.filter(t => {
    if (t.status === "completed" || t.status === "cancelled") return false;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < now;
  }).length;
  const upcomingEvents = events.filter(e => new Date(e.startTime) > now && new Date(e.startTime) < new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).length;
  const activeShifts = shifts.filter(s => s.status === "scheduled" || s.status === "in_progress").length;
  const recentNotes = notes.filter(n => new Date(n.createdAt) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)).length;

  return { pendingTasks, overdueTasks, upcomingEvents, activeShifts, recentNotes };
}

console.log("[CaregiverCollaboration] Service initialized with task coordination, shared notes, and calendar features");
