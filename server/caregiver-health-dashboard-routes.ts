/**
 * Caregiver Health Dashboard Routes
 * Patient-centric dashboard consolidating key health information at a glance
 * with customizable layout preferences per caregiver
 */

import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const SYSTEM_CAREGIVER_ID = "caregiver-michael-001";
const SAMPLE_PATIENT_ID = "patient-001";

export interface DashboardWidget {
  id: string;
  type: "medications" | "appointments" | "vitals" | "alerts" | "tasks" | "notes" | "conditions" | "documents";
  title: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large";
  collapsed?: boolean;
}

export interface DashboardLayoutPreferences {
  caregiverId: string;
  patientId: string;
  widgets: DashboardWidget[];
  theme: "default" | "compact" | "expanded";
  refreshInterval: number;
  updatedAt: string;
}

export interface PatientVitalSummary {
  type: string;
  label: string;
  value: string;
  unit: string;
  status: "normal" | "warning" | "critical";
  recordedAt: string;
  trend?: "up" | "down" | "stable";
}

export interface PatientMedicationSummary {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  nextDue?: string;
  adherenceRate: number;
  refillNeeded: boolean;
  refillDueDate?: string;
}

export interface PatientAppointmentSummary {
  id: string;
  date: string;
  time: string;
  provider: string;
  specialty: string;
  type: string;
  location: string;
  status: "confirmed" | "pending" | "needs_confirmation";
  notes?: string;
}

export interface PatientAlertSummary {
  id: string;
  type: "medication" | "appointment" | "vital" | "document" | "care_plan" | "system";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  requiresAction: boolean;
  actionUrl?: string;
}

export interface TaskAssignment {
  id: string;
  title: string;
  description: string;
  category: "medication" | "appointment" | "monitoring" | "documentation" | "communication" | "other";
  priority: "low" | "normal" | "high" | "urgent";
  status: "pending" | "in_progress" | "completed" | "overdue";
  dueDate?: string;
  assignedTo: string;
  assignedBy: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  completedAt?: string;
}

export interface CaregiverHealthDashboard {
  patientId: string;
  patientName: string;
  patientPhoto?: string;
  relationship: string;
  lastUpdated: string;
  overallHealthScore?: number;
  medications: PatientMedicationSummary[];
  appointments: PatientAppointmentSummary[];
  vitals: PatientVitalSummary[];
  alerts: PatientAlertSummary[];
  tasks: TaskAssignment[];
  conditions: Array<{ name: string; status: string; severity?: string }>;
  recentNotes: Array<{ id: string; content: string; author: string; createdAt: string }>;
}

const layoutPreferencesStore = new Map<string, DashboardLayoutPreferences>();
const tasksStore = new Map<string, TaskAssignment>();

function getDefaultWidgets(): DashboardWidget[] {
  return [
    { id: "alerts", type: "alerts", title: "Active Alerts", enabled: true, order: 0, size: "large" },
    { id: "vitals", type: "vitals", title: "Recent Vitals", enabled: true, order: 1, size: "medium" },
    { id: "medications", type: "medications", title: "Current Medications", enabled: true, order: 2, size: "large" },
    { id: "appointments", type: "appointments", title: "Upcoming Appointments", enabled: true, order: 3, size: "medium" },
    { id: "tasks", type: "tasks", title: "Task Assignments", enabled: true, order: 4, size: "medium" },
    { id: "conditions", type: "conditions", title: "Active Conditions", enabled: true, order: 5, size: "small" },
    { id: "notes", type: "notes", title: "Recent Care Notes", enabled: true, order: 6, size: "medium" },
    { id: "documents", type: "documents", title: "Recent Documents", enabled: false, order: 7, size: "small" },
  ];
}

function initializeSampleData() {
  if (tasksStore.size > 0) return;

  const now = new Date();
  const sampleTasks: TaskAssignment[] = [
    {
      id: "task-001",
      title: "Administer morning medication",
      description: "Give Metformin 500mg with breakfast",
      category: "medication",
      priority: "high",
      status: "pending",
      dueDate: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      assignedTo: SYSTEM_CAREGIVER_ID,
      assignedBy: "Dr. Sarah Johnson",
      patientId: SAMPLE_PATIENT_ID,
      patientName: "Sarah Johnson",
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "task-002",
      title: "Check blood pressure",
      description: "Take and record morning blood pressure reading",
      category: "monitoring",
      priority: "normal",
      status: "pending",
      dueDate: new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      assignedTo: SYSTEM_CAREGIVER_ID,
      assignedBy: "Dr. Michael Chen",
      patientId: SAMPLE_PATIENT_ID,
      patientName: "Sarah Johnson",
      createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "task-003",
      title: "Prepare for oncology appointment",
      description: "Gather recent lab results and list of current medications for upcoming visit",
      category: "appointment",
      priority: "high",
      status: "in_progress",
      dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      assignedTo: SYSTEM_CAREGIVER_ID,
      assignedBy: "System",
      patientId: SAMPLE_PATIENT_ID,
      patientName: "Sarah Johnson",
      createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "task-004",
      title: "Request medication refill",
      description: "Contact pharmacy for Lisinopril refill - running low",
      category: "medication",
      priority: "urgent",
      status: "overdue",
      dueDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      assignedTo: SYSTEM_CAREGIVER_ID,
      assignedBy: "System",
      patientId: SAMPLE_PATIENT_ID,
      patientName: "Sarah Johnson",
      createdAt: new Date(now.getTime() - 96 * 60 * 60 * 1000).toISOString(),
    },
  ];

  sampleTasks.forEach(task => tasksStore.set(task.id, task));
}

initializeSampleData();

function generateSampleVitals(): PatientVitalSummary[] {
  const now = new Date();
  return [
    {
      type: "blood_pressure",
      label: "Blood Pressure",
      value: "128/82",
      unit: "mmHg",
      status: "normal",
      recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      trend: "stable",
    },
    {
      type: "heart_rate",
      label: "Heart Rate",
      value: "72",
      unit: "bpm",
      status: "normal",
      recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      trend: "stable",
    },
    {
      type: "glucose",
      label: "Blood Glucose",
      value: "142",
      unit: "mg/dL",
      status: "warning",
      recordedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      trend: "up",
    },
    {
      type: "temperature",
      label: "Temperature",
      value: "98.6",
      unit: "°F",
      status: "normal",
      recordedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      trend: "stable",
    },
    {
      type: "oxygen",
      label: "Oxygen Saturation",
      value: "97",
      unit: "%",
      status: "normal",
      recordedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      trend: "stable",
    },
    {
      type: "weight",
      label: "Weight",
      value: "165",
      unit: "lbs",
      status: "normal",
      recordedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      trend: "down",
    },
  ];
}

function generateSampleMedications(): PatientMedicationSummary[] {
  const now = new Date();
  return [
    {
      id: "med-001",
      name: "Metformin",
      dosage: "500mg",
      frequency: "Twice daily with meals",
      nextDue: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      adherenceRate: 92,
      refillNeeded: false,
      refillDueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "med-002",
      name: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily in morning",
      nextDue: new Date(now.getTime() + 14 * 60 * 60 * 1000).toISOString(),
      adherenceRate: 88,
      refillNeeded: true,
      refillDueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "med-003",
      name: "Atorvastatin",
      dosage: "20mg",
      frequency: "Once daily at bedtime",
      nextDue: new Date(now.getTime() + 10 * 60 * 60 * 1000).toISOString(),
      adherenceRate: 95,
      refillNeeded: false,
      refillDueDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "med-004",
      name: "Omeprazole",
      dosage: "20mg",
      frequency: "Once daily before breakfast",
      nextDue: new Date(now.getTime() + 12 * 60 * 60 * 1000).toISOString(),
      adherenceRate: 90,
      refillNeeded: false,
    },
  ];
}

function generateSampleAppointments(): PatientAppointmentSummary[] {
  const now = new Date();
  return [
    {
      id: "apt-001",
      date: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      time: "10:00 AM",
      provider: "Dr. Sarah Johnson",
      specialty: "Oncology",
      type: "Follow-up",
      location: "City Cancer Center, Room 302",
      status: "confirmed",
      notes: "Bring recent lab results",
    },
    {
      id: "apt-002",
      date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      time: "2:30 PM",
      provider: "Dr. Michael Chen",
      specialty: "Primary Care",
      type: "Annual Checkup",
      location: "Family Health Clinic",
      status: "confirmed",
    },
    {
      id: "apt-003",
      date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      time: "9:00 AM",
      provider: "Dr. Lisa Park",
      specialty: "Cardiology",
      type: "Consultation",
      location: "Heart Health Center",
      status: "pending",
      notes: "First visit - bring medical history",
    },
  ];
}

function generateSampleAlerts(): PatientAlertSummary[] {
  const now = new Date();
  return [
    {
      id: "alert-001",
      type: "medication",
      priority: "urgent",
      title: "Medication Refill Needed",
      message: "Lisinopril prescription needs to be refilled. Currently 3 days past due.",
      timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      requiresAction: true,
      actionUrl: "/caregiver-portal?tab=medications",
    },
    {
      id: "alert-002",
      type: "vital",
      priority: "high",
      title: "Blood Glucose Elevated",
      message: "Morning blood glucose reading (142 mg/dL) is above target range.",
      timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      requiresAction: true,
    },
    {
      id: "alert-003",
      type: "appointment",
      priority: "normal",
      title: "Appointment Tomorrow",
      message: "Oncology follow-up with Dr. Sarah Johnson at 10:00 AM.",
      timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      isRead: true,
      requiresAction: false,
    },
    {
      id: "alert-004",
      type: "care_plan",
      priority: "normal",
      title: "Care Plan Update",
      message: "Physical therapy exercises for this week have been updated.",
      timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      isRead: true,
      requiresAction: false,
    },
  ];
}

router.get("/api/caregiver/health-dashboard/:patientId", async (req: Request, res: Response) => {
  const { patientId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "CaregiverHealthDashboard",
    resourceId: patientId,
    details: `Caregiver accessed health dashboard for patient ${patientId}`,
  });

  const caregiverTasks = Array.from(tasksStore.values())
    .filter(t => t.patientId === patientId && t.assignedTo === caregiverId)
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const dashboard: CaregiverHealthDashboard = {
    patientId,
    patientName: "Sarah Johnson",
    relationship: "Primary Caregiver (Spouse)",
    lastUpdated: new Date().toISOString(),
    overallHealthScore: 78,
    medications: generateSampleMedications(),
    appointments: generateSampleAppointments(),
    vitals: generateSampleVitals(),
    alerts: generateSampleAlerts(),
    tasks: caregiverTasks,
    conditions: [
      { name: "Type 2 Diabetes", status: "Managed", severity: "moderate" },
      { name: "Hypertension", status: "Under control", severity: "mild" },
      { name: "Hyperlipidemia", status: "Managed", severity: "mild" },
    ],
    recentNotes: [
      {
        id: "note-001",
        content: "Patient reported mild fatigue in the afternoon. Encouraged more rest and hydration.",
        author: "Michael Johnson (Caregiver)",
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "note-002",
        content: "Blood pressure stable after morning medication. No side effects observed.",
        author: "Michael Johnson (Caregiver)",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };

  res.json(dashboard);
});

router.get("/api/caregiver/health-dashboard/:patientId/layout", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  const key = `${caregiverId}:${patientId}`;

  let preferences = layoutPreferencesStore.get(key);

  if (!preferences) {
    preferences = {
      caregiverId,
      patientId,
      widgets: getDefaultWidgets(),
      theme: "default",
      refreshInterval: 300,
      updatedAt: new Date().toISOString(),
    };
    layoutPreferencesStore.set(key, preferences);
  }

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "DashboardLayoutPreferences",
    resourceId: patientId,
    details: "Caregiver retrieved dashboard layout preferences",
  });

  res.json(preferences);
});

router.put("/api/caregiver/health-dashboard/:patientId/layout", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  const { widgets, theme, refreshInterval } = req.body;
  const key = `${caregiverId}:${patientId}`;

  if (widgets && !Array.isArray(widgets)) {
    return res.status(400).json({ error: "widgets must be an array" });
  }

  const existingPreferences = layoutPreferencesStore.get(key);

  const updatedPreferences: DashboardLayoutPreferences = {
    caregiverId,
    patientId,
    widgets: widgets || existingPreferences?.widgets || getDefaultWidgets(),
    theme: theme || existingPreferences?.theme || "default",
    refreshInterval: typeof refreshInterval === "number" ? refreshInterval : existingPreferences?.refreshInterval || 300,
    updatedAt: new Date().toISOString(),
  };

  layoutPreferencesStore.set(key, updatedPreferences);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "DashboardLayoutPreferences",
    resourceId: patientId,
    details: "Caregiver updated dashboard layout preferences",
  });

  res.json({
    success: true,
    preferences: updatedPreferences,
  });
});

router.post("/api/caregiver/health-dashboard/:patientId/layout/reset", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  const key = `${caregiverId}:${patientId}`;

  const defaultPreferences: DashboardLayoutPreferences = {
    caregiverId,
    patientId,
    widgets: getDefaultWidgets(),
    theme: "default",
    refreshInterval: 300,
    updatedAt: new Date().toISOString(),
  };

  layoutPreferencesStore.set(key, defaultPreferences);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "DashboardLayoutPreferences",
    resourceId: patientId,
    details: "Caregiver reset dashboard layout to defaults",
  });

  res.json({
    success: true,
    preferences: defaultPreferences,
  });
});

router.get("/api/caregiver/health-dashboard/:patientId/tasks", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  const status = req.query.status as string;

  let tasks = Array.from(tasksStore.values())
    .filter(t => t.patientId === patientId && t.assignedTo === caregiverId);

  if (status) {
    tasks = tasks.filter(t => t.status === status);
  }

  tasks.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "TaskAssignment",
    resourceId: patientId,
    details: `Caregiver retrieved tasks for patient ${patientId}`,
  });

  res.json({
    tasks,
    counts: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === "pending").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      completed: tasks.filter(t => t.status === "completed").length,
      overdue: tasks.filter(t => t.status === "overdue").length,
    },
  });
});

router.post("/api/caregiver/health-dashboard/:patientId/tasks", (req: Request, res: Response) => {
  const { patientId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  const { title, description, category, priority, dueDate, patientName } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  const task: TaskAssignment = {
    id: `task-${Date.now()}`,
    title,
    description: description || "",
    category: category || "other",
    priority: priority || "normal",
    status: "pending",
    dueDate,
    assignedTo: caregiverId,
    assignedBy: "Caregiver",
    patientId,
    patientName: patientName || "Patient",
    createdAt: new Date().toISOString(),
  };

  tasksStore.set(task.id, task);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "TaskAssignment",
    resourceId: task.id,
    details: `Caregiver created task: ${title}`,
  });

  res.status(201).json({
    success: true,
    task,
  });
});

router.put("/api/caregiver/health-dashboard/tasks/:taskId", (req: Request, res: Response) => {
  const { taskId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  const { status, notes } = req.body;

  const task = tasksStore.get(taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  if (task.assignedTo !== caregiverId) {
    return res.status(403).json({ error: "Not authorized to update this task" });
  }

  if (status) {
    task.status = status;
    if (status === "completed") {
      task.completedAt = new Date().toISOString();
    }
  }

  tasksStore.set(taskId, task);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "TaskAssignment",
    resourceId: taskId,
    details: `Caregiver updated task status to ${status}`,
  });

  res.json({
    success: true,
    task,
  });
});

router.post("/api/caregiver/health-dashboard/:patientId/alerts/:alertId/acknowledge", (req: Request, res: Response) => {
  const { patientId, alertId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "PatientAlert",
    resourceId: alertId,
    details: `Caregiver acknowledged alert ${alertId} for patient ${patientId}`,
  });

  res.json({
    success: true,
    alertId,
    acknowledgedAt: new Date().toISOString(),
  });
});

router.get("/api/caregiver/health-dashboard/summary", (req: Request, res: Response) => {
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;

  const allTasks = Array.from(tasksStore.values())
    .filter(t => t.assignedTo === caregiverId);

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "CaregiverHealthDashboard",
    resourceId: "summary",
    details: "Caregiver retrieved dashboard summary",
  });

  res.json({
    caregiverId,
    totalPatients: 2,
    urgentAlerts: 2,
    pendingTasks: allTasks.filter(t => t.status === "pending" || t.status === "overdue").length,
    upcomingAppointments: 3,
    medicationsNeedingRefill: 1,
  });
});

console.log("[CaregiverHealthDashboard] Routes registered at /api/caregiver/health-dashboard/*");

export { router as caregiverHealthDashboardRoutes };
