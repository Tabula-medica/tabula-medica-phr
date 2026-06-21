import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import { format } from "date-fns";
import { clinicianTaskTypes, clinicianTaskPriorities } from "@shared/schema";

const router = Router();

interface StoredTask {
  id: string;
  taskType: string;
  title: string;
  description: string;
  patientId: string;
  patientName: string;
  priority: string;
  status: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: string;
  insightSource?: string;
  tags: string[];
}

interface StoredAppointmentRequest {
  id: string;
  patientId: string;
  patientName: string;
  appointmentType: string;
  reason: string;
  preferredDate: string;
  preferredTimeSlot: string;
  urgency: string;
  status: string;
  createdAt: string;
  insightSource?: string;
  requestedBy: string;
}

interface StoredChartNote {
  id: string;
  patientId: string;
  patientName: string;
  noteType: string;
  content: string;
  category: string;
  createdAt: string;
  createdBy: string;
  insightSource?: string;
  status: string;
}

const tasks: StoredTask[] = [];
const appointmentRequests: StoredAppointmentRequest[] = [];
const chartNotes: StoredChartNote[] = [];

const MOCK_CLINICIAN_ID = "dr-smith-001";
const MOCK_CLINICIAN_NAME = "Dr. Sarah Smith";

const allowedTaskTypes = [
  "review_results",
  "sign_orders", 
  "respond_message",
  "review_referral",
  "complete_documentation",
  "prior_authorization",
  "prescription_renewal",
  "care_plan_update",
  "patient_callback",
  "other"
] as const;

const allowedPriorities = ["urgent", "high", "normal", "low"] as const;

const allowedAppointmentTypes = [
  "follow_up",
  "urgent",
  "consultation",
  "telehealth",
  "routine",
  "new_patient"
] as const;

const allowedUrgencyLevels = ["urgent", "soon", "routine"] as const;

const allowedTimeSlots = ["Morning", "Afternoon", "Late Morning", "Any"] as const;

const allowedNoteTypes = [
  "clinical_observation",
  "lab_interpretation",
  "medication_note",
  "care_coordination",
  "patient_communication"
] as const;

const allowedNoteCategories = ["progress", "lab_results", "medications", "assessment", "plan"] as const;

const createTaskSchema = z.object({
  taskType: z.enum(allowedTaskTypes),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  description: z.string().max(2000, "Description too long"),
  patientId: z.string().min(1, "Patient ID is required"),
  patientName: z.string().min(1, "Patient name is required"),
  priority: z.enum(allowedPriorities),
  dueDate: z.string().optional(),
  insightSource: z.string().max(500).optional(),
});

const createAppointmentSchema = z.object({
  appointmentType: z.enum(allowedAppointmentTypes),
  reason: z.string().min(1, "Reason is required").max(500, "Reason too long"),
  preferredDate: z.string(),
  preferredTimeSlot: z.enum(allowedTimeSlots),
  urgency: z.enum(allowedUrgencyLevels),
  patientId: z.string().min(1, "Patient ID is required"),
  patientName: z.string().min(1, "Patient name is required"),
  insightSource: z.string().max(500).optional(),
});

const createChartNoteSchema = z.object({
  noteType: z.enum(allowedNoteTypes),
  content: z.string().min(1, "Content is required").max(5000, "Content too long"),
  category: z.enum(allowedNoteCategories),
  patientId: z.string().min(1, "Patient ID is required"),
  patientName: z.string().min(1, "Patient name is required"),
  insightSource: z.string().max(500).optional(),
});

router.post("/task", async (req: Request, res: Response) => {
  try {
    const validated = createTaskSchema.parse(req.body);
    
    const task: StoredTask = {
      id: `task-${randomUUID().slice(0, 8)}`,
      taskType: validated.taskType,
      title: validated.title,
      description: validated.description,
      patientId: validated.patientId,
      patientName: validated.patientName,
      priority: validated.priority,
      status: "pending",
      dueDate: validated.dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
      insightSource: validated.insightSource,
      tags: ["ai-generated", "insight-action"],
    };
    
    tasks.push(task);
    
    console.log(`[ClinicianWorkflow] Task created: ${task.id} for patient ${validated.patientName}`);
    
    res.status(201).json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        dueDate: task.dueDate,
        status: task.status,
        createdAt: task.createdAt,
      },
      message: `Task "${task.title}" created successfully`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
      return;
    }
    console.error("[ClinicianWorkflow] Error creating task:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create task",
    });
  }
});

router.post("/appointment", async (req: Request, res: Response) => {
  try {
    const validated = createAppointmentSchema.parse(req.body);
    
    const appointmentRequest: StoredAppointmentRequest = {
      id: `appt-req-${randomUUID().slice(0, 8)}`,
      patientId: validated.patientId,
      patientName: validated.patientName,
      appointmentType: validated.appointmentType,
      reason: validated.reason,
      preferredDate: validated.preferredDate,
      preferredTimeSlot: validated.preferredTimeSlot,
      urgency: validated.urgency,
      status: "pending",
      createdAt: new Date().toISOString(),
      insightSource: validated.insightSource,
      requestedBy: MOCK_CLINICIAN_ID,
    };
    
    appointmentRequests.push(appointmentRequest);
    
    console.log(`[ClinicianWorkflow] Appointment request created: ${appointmentRequest.id} for patient ${validated.patientName}`);
    
    res.status(201).json({
      success: true,
      appointmentRequest: {
        id: appointmentRequest.id,
        patientName: appointmentRequest.patientName,
        appointmentType: appointmentRequest.appointmentType,
        preferredDate: appointmentRequest.preferredDate,
        urgency: appointmentRequest.urgency,
        status: appointmentRequest.status,
        createdAt: appointmentRequest.createdAt,
      },
      message: `Appointment request for ${validated.patientName} submitted successfully`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
      return;
    }
    console.error("[ClinicianWorkflow] Error creating appointment request:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create appointment request",
    });
  }
});

router.post("/chart-note", async (req: Request, res: Response) => {
  try {
    const validated = createChartNoteSchema.parse(req.body);
    
    const chartNote: StoredChartNote = {
      id: `note-${randomUUID().slice(0, 8)}`,
      patientId: validated.patientId,
      patientName: validated.patientName,
      noteType: validated.noteType,
      content: validated.content,
      category: validated.category,
      createdAt: new Date().toISOString(),
      createdBy: MOCK_CLINICIAN_ID,
      insightSource: validated.insightSource,
      status: "active",
    };
    
    chartNotes.push(chartNote);
    
    console.log(`[ClinicianWorkflow] Chart note created: ${chartNote.id} for patient ${validated.patientName}`);
    
    res.status(201).json({
      success: true,
      chartNote: {
        id: chartNote.id,
        patientName: chartNote.patientName,
        noteType: chartNote.noteType,
        category: chartNote.category,
        createdAt: chartNote.createdAt,
      },
      message: `Chart note added to ${validated.patientName}'s record`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
      return;
    }
    console.error("[ClinicianWorkflow] Error creating chart note:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create chart note",
    });
  }
});

router.get("/tasks", async (req: Request, res: Response) => {
  const patientId = req.query.patientId as string | undefined;
  
  let filteredTasks = tasks;
  if (patientId) {
    filteredTasks = tasks.filter(t => t.patientId === patientId);
  }
  
  res.json({
    success: true,
    tasks: filteredTasks.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    total: filteredTasks.length,
  });
});

router.get("/appointment-requests", async (req: Request, res: Response) => {
  const patientId = req.query.patientId as string | undefined;
  
  let filtered = appointmentRequests;
  if (patientId) {
    filtered = appointmentRequests.filter(a => a.patientId === patientId);
  }
  
  res.json({
    success: true,
    appointmentRequests: filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    total: filtered.length,
  });
});

router.get("/chart-notes", async (req: Request, res: Response) => {
  const patientId = req.query.patientId as string | undefined;
  
  let filtered = chartNotes;
  if (patientId) {
    filtered = chartNotes.filter(n => n.patientId === patientId);
  }
  
  res.json({
    success: true,
    chartNotes: filtered.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
    total: filtered.length,
  });
});

router.patch("/task/:taskId", async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { status, priority, notes } = req.body;
  
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex === -1) {
    res.status(404).json({ success: false, error: "Task not found" });
    return;
  }
  
  if (status) tasks[taskIndex].status = status;
  if (priority) tasks[taskIndex].priority = priority;
  tasks[taskIndex].updatedAt = new Date().toISOString();
  
  res.json({
    success: true,
    task: tasks[taskIndex],
    message: "Task updated successfully",
  });
});

export default router;
