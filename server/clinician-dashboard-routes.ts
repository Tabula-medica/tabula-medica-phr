import { Router, Request, Response } from "express";
import { z } from "zod";
import { format, subDays, subHours, addDays } from "date-fns";
import type {
  RemoteVitalAlert,
  PendingAppointmentRequest,
  AIFollowUpPatient,
  ClinicianTask,
  ClinicianDashboardSummary,
  VitalAlertSeverity,
  FollowUpReason,
  ClinicianTaskType,
} from "@shared/schema";

const router = Router();

const MOCK_CLINICIAN_ID = "dr-smith-001";
const MOCK_CLINICIAN_NAME = "Dr. Sarah Smith";

function generateMockVitalAlerts(): RemoteVitalAlert[] {
  const alerts: RemoteVitalAlert[] = [
    {
      id: "va-001",
      patientId: "p-001",
      patientName: "John Martinez",
      vitalType: "Blood Pressure",
      value: 185,
      unit: "mmHg (systolic)",
      normalRange: { min: 90, max: 140 },
      severity: "critical",
      status: "new",
      triggeredAt: subHours(new Date(), 1).toISOString(),
      deviceType: "Omron BP Monitor",
      trendDirection: "increasing",
      previousValues: [
        { value: 165, timestamp: subHours(new Date(), 24).toISOString() },
        { value: 158, timestamp: subHours(new Date(), 48).toISOString() },
      ],
    },
    {
      id: "va-002",
      patientId: "p-002",
      patientName: "Maria Garcia",
      vitalType: "Heart Rate",
      value: 112,
      unit: "bpm",
      normalRange: { min: 60, max: 100 },
      severity: "high",
      status: "new",
      triggeredAt: subHours(new Date(), 3).toISOString(),
      deviceType: "Apple Watch",
      trendDirection: "stable",
    },
    {
      id: "va-003",
      patientId: "p-003",
      patientName: "Robert Chen",
      vitalType: "Blood Glucose",
      value: 245,
      unit: "mg/dL",
      normalRange: { min: 70, max: 140 },
      severity: "high",
      status: "acknowledged",
      triggeredAt: subHours(new Date(), 6).toISOString(),
      acknowledgedAt: subHours(new Date(), 5).toISOString(),
      acknowledgedBy: MOCK_CLINICIAN_NAME,
      deviceType: "Dexcom G6",
      trendDirection: "increasing",
    },
    {
      id: "va-004",
      patientId: "p-004",
      patientName: "Sarah Williams",
      vitalType: "Oxygen Saturation",
      value: 91,
      unit: "%",
      normalRange: { min: 95, max: 100 },
      severity: "moderate",
      status: "new",
      triggeredAt: subHours(new Date(), 8).toISOString(),
      deviceType: "Pulse Oximeter",
      trendDirection: "decreasing",
    },
    {
      id: "va-005",
      patientId: "p-005",
      patientName: "James Johnson",
      vitalType: "Weight",
      value: 198,
      unit: "lbs",
      normalRange: { min: 160, max: 180 },
      severity: "low",
      status: "new",
      triggeredAt: subHours(new Date(), 12).toISOString(),
      deviceType: "Withings Scale",
      notes: "5 lb gain in past week - possible fluid retention",
      trendDirection: "increasing",
    },
  ];
  return alerts;
}

function generateMockAppointmentRequests(): PendingAppointmentRequest[] {
  const requests: PendingAppointmentRequest[] = [
    {
      id: "ar-001",
      patientId: "p-006",
      patientName: "Emily Davis",
      requestType: "urgent",
      requestedDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      requestedTimeSlot: "Morning",
      reason: "Severe chest pain episodes over past 2 days",
      urgencyLevel: "urgent",
      status: "pending",
      submittedAt: subHours(new Date(), 2).toISOString(),
      insuranceVerified: true,
      previousVisitDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    },
    {
      id: "ar-002",
      patientId: "p-007",
      patientName: "Michael Brown",
      requestType: "follow_up",
      requestedDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
      requestedTimeSlot: "Afternoon",
      reason: "Follow-up for medication adjustment - blood pressure control",
      urgencyLevel: "soon",
      status: "pending",
      submittedAt: subHours(new Date(), 8).toISOString(),
      insuranceVerified: true,
      previousVisitDate: format(subDays(new Date(), 14), "yyyy-MM-dd"),
    },
    {
      id: "ar-003",
      patientId: "p-008",
      patientName: "Linda Thompson",
      requestType: "new_patient",
      requestedDate: format(addDays(new Date(), 7), "yyyy-MM-dd"),
      reason: "New patient consultation - diabetes management referral",
      urgencyLevel: "routine",
      status: "pending",
      submittedAt: subDays(new Date(), 1).toISOString(),
      insuranceVerified: false,
      preferredProvider: MOCK_CLINICIAN_NAME,
    },
    {
      id: "ar-004",
      patientId: "p-009",
      patientName: "David Wilson",
      requestType: "telehealth",
      requestedDate: format(addDays(new Date(), 2), "yyyy-MM-dd"),
      requestedTimeSlot: "Late Morning",
      reason: "Medication refill discussion and symptom check",
      urgencyLevel: "routine",
      status: "pending",
      submittedAt: subHours(new Date(), 18).toISOString(),
      insuranceVerified: true,
    },
  ];
  return requests;
}

function generateMockFollowUpPatients(): AIFollowUpPatient[] {
  const patients: AIFollowUpPatient[] = [
    {
      id: "fu-001",
      patientId: "p-010",
      patientName: "Catherine Anderson",
      age: 67,
      conditions: ["Type 2 Diabetes", "Hypertension", "Chronic Kidney Disease Stage 3"],
      followUpReason: "deteriorating_vitals",
      priority: "critical",
      aiConfidenceScore: 0.94,
      aiRationale: "Patient's blood pressure readings have consistently exceeded 160/100 mmHg over the past week despite current medication regimen. Combined with declining eGFR trend, immediate intervention may be needed.",
      suggestedAction: "Schedule urgent follow-up to review antihypertensive therapy and assess kidney function",
      suggestedTimeframe: "Within 24-48 hours",
      lastVisitDate: format(subDays(new Date(), 45), "yyyy-MM-dd"),
      daysSinceLastVisit: 45,
      riskFactors: ["Uncontrolled hypertension", "Progressive CKD", "Polypharmacy"],
      relevantMetrics: [
        { name: "BP (avg)", value: "168/102 mmHg", status: "abnormal" },
        { name: "eGFR", value: "38 mL/min", status: "abnormal" },
        { name: "HbA1c", value: "7.8%", status: "borderline" },
      ],
      generatedAt: new Date().toISOString(),
      status: "pending",
    },
    {
      id: "fu-002",
      patientId: "p-011",
      patientName: "Richard Kim",
      age: 58,
      conditions: ["Atrial Fibrillation", "Heart Failure (HFrEF)"],
      followUpReason: "abnormal_lab_results",
      priority: "high",
      aiConfidenceScore: 0.89,
      aiRationale: "Recent BNP level significantly elevated at 890 pg/mL, indicating potential heart failure exacerbation. Weight has increased 4 lbs in past week suggesting fluid retention.",
      suggestedAction: "Review diuretic therapy and assess for signs of decompensation",
      suggestedTimeframe: "Within 2-3 days",
      lastVisitDate: format(subDays(new Date(), 21), "yyyy-MM-dd"),
      daysSinceLastVisit: 21,
      riskFactors: ["Elevated BNP", "Fluid retention", "Suboptimal GDMT titration"],
      relevantMetrics: [
        { name: "BNP", value: "890 pg/mL", status: "abnormal" },
        { name: "Weight change", value: "+4 lbs (7 days)", status: "abnormal" },
        { name: "LVEF", value: "35%", status: "abnormal" },
      ],
      generatedAt: new Date().toISOString(),
      status: "pending",
    },
    {
      id: "fu-003",
      patientId: "p-012",
      patientName: "Susan Miller",
      age: 72,
      conditions: ["COPD", "Osteoporosis"],
      followUpReason: "medication_adherence",
      priority: "medium",
      aiConfidenceScore: 0.85,
      aiRationale: "Medication adherence tracking shows 65% compliance with inhaler therapy. Patient may benefit from education on proper inhaler technique and adherence counseling.",
      suggestedAction: "Schedule follow-up for inhaler technique review and adherence discussion",
      suggestedTimeframe: "Within 1 week",
      lastVisitDate: format(subDays(new Date(), 60), "yyyy-MM-dd"),
      daysSinceLastVisit: 60,
      riskFactors: ["Poor medication adherence", "Risk of COPD exacerbation"],
      relevantMetrics: [
        { name: "Inhaler adherence", value: "65%", status: "borderline" },
        { name: "FEV1", value: "58% predicted", status: "borderline" },
      ],
      generatedAt: new Date().toISOString(),
      status: "pending",
    },
    {
      id: "fu-004",
      patientId: "p-013",
      patientName: "Thomas Lee",
      age: 45,
      conditions: ["Hyperlipidemia", "Pre-diabetes"],
      followUpReason: "preventive_care_due",
      priority: "low",
      aiConfidenceScore: 0.82,
      aiRationale: "Annual lipid panel and HbA1c screening are due. Last cardiovascular risk assessment was over 12 months ago.",
      suggestedAction: "Schedule routine preventive care visit with labs",
      suggestedTimeframe: "Within 2-4 weeks",
      lastVisitDate: format(subDays(new Date(), 380), "yyyy-MM-dd"),
      daysSinceLastVisit: 380,
      relevantMetrics: [
        { name: "Last LDL", value: "145 mg/dL", status: "borderline" },
        { name: "Last HbA1c", value: "5.9%", status: "borderline" },
      ],
      generatedAt: new Date().toISOString(),
      status: "pending",
    },
  ];
  return patients;
}

function generateMockClinicianTasks(): ClinicianTask[] {
  const tasks: ClinicianTask[] = [
    {
      id: "task-001",
      taskType: "review_results",
      title: "Review abnormal lab results",
      description: "Critical potassium level (6.2 mEq/L) for patient Maria Garcia requires immediate review and action",
      patientId: "p-002",
      patientName: "Maria Garcia",
      priority: "urgent",
      status: "pending",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      createdAt: subHours(new Date(), 2).toISOString(),
      updatedAt: subHours(new Date(), 2).toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
      tags: ["labs", "critical"],
    },
    {
      id: "task-002",
      taskType: "sign_orders",
      title: "Sign pending medication orders",
      description: "3 medication orders awaiting signature for patient discharge",
      patientId: "p-014",
      patientName: "Jennifer Taylor",
      priority: "high",
      status: "pending",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      createdAt: subHours(new Date(), 4).toISOString(),
      updatedAt: subHours(new Date(), 4).toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
      tags: ["orders", "discharge"],
    },
    {
      id: "task-003",
      taskType: "respond_message",
      title: "Patient message - medication question",
      description: "Patient asking about new statin medication side effects",
      patientId: "p-015",
      patientName: "Mark Robinson",
      priority: "normal",
      status: "pending",
      dueDate: format(addDays(new Date(), 1), "yyyy-MM-dd"),
      createdAt: subHours(new Date(), 8).toISOString(),
      updatedAt: subHours(new Date(), 8).toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
      tags: ["message", "medication"],
    },
    {
      id: "task-004",
      taskType: "prior_authorization",
      title: "Prior authorization for MRI",
      description: "Complete prior authorization request for lumbar MRI",
      patientId: "p-016",
      patientName: "Nancy White",
      priority: "normal",
      status: "in_progress",
      dueDate: format(addDays(new Date(), 2), "yyyy-MM-dd"),
      createdAt: subDays(new Date(), 1).toISOString(),
      updatedAt: subHours(new Date(), 6).toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
      tags: ["authorization", "imaging"],
    },
    {
      id: "task-005",
      taskType: "prescription_renewal",
      title: "Refill request - Metformin",
      description: "Patient requesting 90-day refill of Metformin 1000mg",
      patientId: "p-017",
      patientName: "George Harris",
      priority: "normal",
      status: "pending",
      dueDate: format(addDays(new Date(), 3), "yyyy-MM-dd"),
      createdAt: subHours(new Date(), 12).toISOString(),
      updatedAt: subHours(new Date(), 12).toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
      tags: ["refill", "diabetes"],
    },
    {
      id: "task-006",
      taskType: "complete_documentation",
      title: "Complete visit note",
      description: "Finalize documentation for yesterday's telehealth visit",
      patientId: "p-018",
      patientName: "Barbara Clark",
      priority: "high",
      status: "pending",
      dueDate: format(new Date(), "yyyy-MM-dd"),
      createdAt: subDays(new Date(), 1).toISOString(),
      updatedAt: subDays(new Date(), 1).toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
      tags: ["documentation"],
    },
  ];
  return tasks;
}

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const vitalAlerts = generateMockVitalAlerts();
    const appointmentRequests = generateMockAppointmentRequests();
    const followUpPatients = generateMockFollowUpPatients();
    const tasks = generateMockClinicianTasks();

    const summary: ClinicianDashboardSummary = {
      clinicianId: MOCK_CLINICIAN_ID,
      clinicianName: MOCK_CLINICIAN_NAME,
      lastUpdated: new Date().toISOString(),
      vitalAlerts: {
        total: vitalAlerts.length,
        critical: vitalAlerts.filter(a => a.severity === "critical").length,
        high: vitalAlerts.filter(a => a.severity === "high").length,
        newCount: vitalAlerts.filter(a => a.status === "new").length,
      },
      appointmentRequests: {
        total: appointmentRequests.length,
        urgent: appointmentRequests.filter(r => r.urgencyLevel === "urgent" || r.urgencyLevel === "emergency").length,
        pendingToday: appointmentRequests.filter(r => 
          r.requestedDate === format(new Date(), "yyyy-MM-dd")
        ).length,
      },
      followUpPatients: {
        total: followUpPatients.length,
        highPriority: followUpPatients.filter(p => p.priority === "high").length,
        criticalPriority: followUpPatients.filter(p => p.priority === "critical").length,
      },
      tasks: {
        total: tasks.length,
        overdue: tasks.filter(t => 
          t.dueDate && new Date(t.dueDate) < new Date() && t.status === "pending"
        ).length,
        dueTodayCount: tasks.filter(t => 
          t.dueDate === format(new Date(), "yyyy-MM-dd")
        ).length,
        pendingCount: tasks.filter(t => t.status === "pending").length,
      },
    };

    res.json(summary);
  } catch (error) {
    console.error("Error fetching clinician dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

router.get("/vital-alerts", async (req: Request, res: Response) => {
  try {
    const severity = req.query.severity as VitalAlertSeverity | undefined;
    const status = req.query.status as string | undefined;

    let alerts = generateMockVitalAlerts();

    if (severity) {
      alerts = alerts.filter(a => a.severity === severity);
    }
    if (status) {
      alerts = alerts.filter(a => a.status === status);
    }

    alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    res.json(alerts);
  } catch (error) {
    console.error("Error fetching vital alerts:", error);
    res.status(500).json({ error: "Failed to fetch vital alerts" });
  }
});

router.post("/vital-alerts/:alertId/acknowledge", async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { notes } = req.body;

    res.json({
      success: true,
      alertId,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: MOCK_CLINICIAN_NAME,
      notes,
    });
  } catch (error) {
    console.error("Error acknowledging vital alert:", error);
    res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

router.get("/appointment-requests", async (req: Request, res: Response) => {
  try {
    const urgency = req.query.urgency as string | undefined;

    let requests = generateMockAppointmentRequests();

    if (urgency) {
      requests = requests.filter(r => r.urgencyLevel === urgency);
    }

    requests.sort((a, b) => {
      const urgencyOrder = { emergency: 0, urgent: 1, soon: 2, routine: 3 };
      return urgencyOrder[a.urgencyLevel] - urgencyOrder[b.urgencyLevel];
    });

    res.json(requests);
  } catch (error) {
    console.error("Error fetching appointment requests:", error);
    res.status(500).json({ error: "Failed to fetch appointment requests" });
  }
});

router.post("/appointment-requests/:requestId/action", async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action, scheduledDate, scheduledTime, notes } = req.body;

    res.json({
      success: true,
      requestId,
      action,
      scheduledDate,
      scheduledTime,
      processedAt: new Date().toISOString(),
      notes,
    });
  } catch (error) {
    console.error("Error processing appointment request:", error);
    res.status(500).json({ error: "Failed to process appointment request" });
  }
});

router.get("/follow-up-patients", async (req: Request, res: Response) => {
  try {
    const priority = req.query.priority as string | undefined;
    const reason = req.query.reason as FollowUpReason | undefined;

    let patients = generateMockFollowUpPatients();

    if (priority) {
      patients = patients.filter(p => p.priority === priority);
    }
    if (reason) {
      patients = patients.filter(p => p.followUpReason === reason);
    }

    patients.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    res.json(patients);
  } catch (error) {
    console.error("Error fetching follow-up patients:", error);
    res.status(500).json({ error: "Failed to fetch follow-up patients" });
  }
});

router.post("/follow-up-patients/:patientId/action", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { action, scheduledDate, notes } = req.body;

    res.json({
      success: true,
      patientId,
      action,
      scheduledDate,
      processedAt: new Date().toISOString(),
      notes,
    });
  } catch (error) {
    console.error("Error processing follow-up action:", error);
    res.status(500).json({ error: "Failed to process follow-up action" });
  }
});

router.get("/tasks", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const taskType = req.query.taskType as ClinicianTaskType | undefined;

    let tasks = generateMockClinicianTasks();

    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    if (taskType) {
      tasks = tasks.filter(t => t.taskType === taskType);
    }

    tasks.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching clinician tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const taskData = req.body;

    const newTask: ClinicianTask = {
      id: `task-${Date.now()}`,
      ...taskData,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: MOCK_CLINICIAN_ID,
    };

    res.status(201).json(newTask);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

router.patch("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;

    res.json({
      id: taskId,
      ...updates,
      updatedAt: new Date().toISOString(),
      completedAt: updates.status === "completed" ? new Date().toISOString() : undefined,
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

router.delete("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    res.json({
      success: true,
      taskId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;