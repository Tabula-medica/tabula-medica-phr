import { Router, Request, Response } from "express";

const router = Router();

interface HealthEvent {
  id: string;
  type: "appointment" | "diagnosis" | "procedure" | "lab" | "medication" | "immunization";
  title: string;
  description: string;
  date: string;
  provider?: string;
  location?: string;
  status: "completed" | "scheduled" | "cancelled";
}

interface VitalSign {
  date: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  temperature?: number;
  weight?: number;
  oxygenSaturation?: number;
}

interface PatientOutcome {
  id: string;
  type: string;
  score: number;
  maxScore: number;
  date: string;
  notes?: string;
}

interface FeedbackSubmission {
  id: string;
  category: string;
  rating: number;
  comment: string;
  submittedAt: string;
  status: "pending" | "reviewed" | "addressed";
}

const sampleEvents: HealthEvent[] = [
  { id: "evt-001", type: "appointment", title: "Annual Physical Exam", description: "Routine annual wellness visit with complete physical examination", date: "2025-01-15", provider: "Dr. Sarah Chen", location: "City Medical Center", status: "completed" },
  { id: "evt-002", type: "diagnosis", title: "Essential Hypertension", description: "Diagnosed with essential hypertension (I10)", date: "2025-01-15", provider: "Dr. Sarah Chen", status: "completed" },
  { id: "evt-003", type: "medication", title: "Lisinopril 10mg Started", description: "Started on Lisinopril 10mg daily for blood pressure control", date: "2025-01-15", provider: "Dr. Sarah Chen", status: "completed" },
  { id: "evt-004", type: "lab", title: "Comprehensive Metabolic Panel", description: "Blood work including glucose, electrolytes, kidney function", date: "2025-01-10", provider: "Quest Diagnostics", location: "Quest Lab Downtown", status: "completed" },
  { id: "evt-005", type: "appointment", title: "Cardiology Follow-up", description: "Follow-up for blood pressure management", date: "2025-02-01", provider: "Dr. Michael Torres", location: "Heart Care Associates", status: "scheduled" },
  { id: "evt-006", type: "procedure", title: "Echocardiogram", description: "Transthoracic echocardiogram to assess heart function", date: "2024-12-15", provider: "Dr. Michael Torres", location: "Heart Care Associates", status: "completed" },
  { id: "evt-007", type: "immunization", title: "Influenza Vaccine", description: "2024-2025 seasonal flu vaccine administered", date: "2024-10-20", provider: "City Pharmacy", status: "completed" },
  { id: "evt-008", type: "diagnosis", title: "Prediabetes", description: "Prediabetes (R73.03) - elevated fasting glucose", date: "2024-11-05", provider: "Dr. Sarah Chen", status: "completed" },
  { id: "evt-009", type: "appointment", title: "Diabetes Education", description: "Nutrition counseling for prediabetes management", date: "2024-11-15", provider: "Jennifer Walsh, RD", location: "Diabetes Education Center", status: "completed" },
  { id: "evt-010", type: "lab", title: "Hemoglobin A1c", description: "HbA1c test for glucose monitoring - Result: 5.9%", date: "2024-11-05", provider: "Quest Diagnostics", status: "completed" }
];

const generateVitals = (): VitalSign[] => {
  const vitals: VitalSign[] = [];
  const baseDate = new Date();
  
  for (let i = 30; i >= 0; i -= 3) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i);
    
    vitals.push({
      date: date.toISOString().split("T")[0],
      systolic: Math.floor(125 + Math.random() * 20 - 10),
      diastolic: Math.floor(82 + Math.random() * 12 - 6),
      heartRate: Math.floor(72 + Math.random() * 16 - 8),
      temperature: parseFloat((98.4 + Math.random() * 0.8 - 0.4).toFixed(1)),
      weight: parseFloat((175 + Math.random() * 4 - 2).toFixed(1)),
      oxygenSaturation: Math.floor(97 + Math.random() * 3)
    });
  }
  
  return vitals;
};

let outcomes: PatientOutcome[] = [
  { id: "out-001", type: "pain", score: 4, maxScore: 10, date: "2025-01-18", notes: "Lower back pain after sitting for long periods" },
  { id: "out-002", type: "sleep", score: 6, maxScore: 10, date: "2025-01-17", notes: "Woke up twice during the night" },
  { id: "out-003", type: "energy", score: 5, maxScore: 10, date: "2025-01-16" },
  { id: "out-004", type: "mood", score: 7, maxScore: 10, date: "2025-01-15", notes: "Feeling positive about treatment progress" }
];

let feedbackList: FeedbackSubmission[] = [
  { id: "fb-001", category: "care_quality", rating: 5, comment: "Dr. Chen was very thorough and took time to explain everything.", submittedAt: "2025-01-16T10:30:00Z", status: "reviewed" },
  { id: "fb-002", category: "wait_times", rating: 3, comment: "Had to wait 45 minutes past my appointment time.", submittedAt: "2025-01-10T14:15:00Z", status: "addressed" }
];

router.get("/events", (_req: Request, res: Response) => {
  res.json({ success: true, data: sampleEvents });
});

router.get("/vitals", (_req: Request, res: Response) => {
  res.json({ success: true, data: generateVitals() });
});

router.get("/outcomes", (_req: Request, res: Response) => {
  res.json({ success: true, data: outcomes.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) });
});

router.post("/outcomes", (req: Request, res: Response) => {
  const { type, score, maxScore, notes } = req.body;
  
  const newOutcome: PatientOutcome = {
    id: `out-${Date.now()}`,
    type,
    score,
    maxScore,
    date: new Date().toISOString().split("T")[0],
    notes
  };
  
  outcomes.unshift(newOutcome);
  
  res.json({ success: true, data: newOutcome });
});

router.get("/feedback", (_req: Request, res: Response) => {
  res.json({ success: true, data: feedbackList.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()) });
});

router.post("/feedback", (req: Request, res: Response) => {
  const { category, rating, comment } = req.body;
  
  if (!comment?.trim()) {
    return res.status(400).json({ success: false, error: "Comment is required" });
  }
  
  const newFeedback: FeedbackSubmission = {
    id: `fb-${Date.now()}`,
    category,
    rating,
    comment,
    submittedAt: new Date().toISOString(),
    status: "pending"
  };
  
  feedbackList.unshift(newFeedback);
  
  res.json({ success: true, data: newFeedback });
});

// ============================================
// APPOINTMENTS MANAGEMENT
// ============================================

interface PatientAppointment {
  id: string;
  profileId: string;
  providerId: string | null;
  providerName: string;
  providerSpecialty: string | null;
  facilityName: string | null;
  facilityAddress: string | null;
  appointmentType: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  isTelehealth: boolean;
  telehealthUrl: string | null;
  notes: string | null;
  reminderSentAt: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const patientAppointments = new Map<string, PatientAppointment>();

function initializeAppointmentData() {
  if (patientAppointments.size > 0) return;
  
  const now = new Date().toISOString();
  const appointments: PatientAppointment[] = [
    {
      id: "appt-001",
      profileId: "profile-self-001",
      providerId: "provider-001",
      providerName: "Dr. Sarah Chen",
      providerSpecialty: "Internal Medicine",
      facilityName: "City Medical Center",
      facilityAddress: "123 Healthcare Blvd, Suite 200",
      appointmentType: "routine_checkup",
      title: "Annual Physical Exam",
      description: "Comprehensive annual health checkup",
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 45,
      status: "confirmed",
      isTelehealth: false,
      telehealthUrl: null,
      notes: "Fasting required for blood work",
      reminderSentAt: null,
      confirmedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      checkedInAt: null,
      completedAt: null,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    },
    {
      id: "appt-002",
      profileId: "profile-self-001",
      providerId: "provider-002",
      providerName: "Dr. Michael Torres",
      providerSpecialty: "Cardiology",
      facilityName: "Heart Health Clinic",
      facilityAddress: "456 Wellness Way",
      appointmentType: "follow_up",
      title: "Cardiology Follow-up",
      description: "Review of recent echocardiogram results",
      scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      status: "scheduled",
      isTelehealth: true,
      telehealthUrl: "https://telehealth.example.com/room/abc123",
      notes: null,
      reminderSentAt: null,
      confirmedAt: null,
      checkedInAt: null,
      completedAt: null,
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    },
    {
      id: "appt-003",
      profileId: "profile-child-001",
      providerId: "provider-003",
      providerName: "Dr. Emily Park",
      providerSpecialty: "Pediatrics",
      facilityName: "Children's Health Center",
      facilityAddress: "789 Kids Care Lane",
      appointmentType: "vaccination",
      title: "Flu Shot",
      description: "Annual influenza vaccination",
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 15,
      status: "confirmed",
      isTelehealth: false,
      telehealthUrl: null,
      notes: "No fever in last 24 hours required",
      reminderSentAt: null,
      confirmedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      checkedInAt: null,
      completedAt: null,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    },
  ];
  
  appointments.forEach(a => patientAppointments.set(a.id, a));
}

initializeAppointmentData();

router.get("/appointments", (req: Request, res: Response) => {
  const { profileId, status, upcoming } = req.query;
  
  let appointments = Array.from(patientAppointments.values());
  
  if (profileId) {
    appointments = appointments.filter(a => a.profileId === profileId);
  }
  
  if (status) {
    appointments = appointments.filter(a => a.status === status);
  }
  
  const now = new Date();
  if (upcoming === "true") {
    appointments = appointments.filter(a => 
      new Date(a.scheduledAt) >= now && 
      !["completed", "cancelled", "no_show"].includes(a.status)
    );
  }
  
  appointments.sort((a, b) => 
    new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
  
  res.json({ success: true, data: appointments });
});

router.get("/appointments/:appointmentId", (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const appointment = patientAppointments.get(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({ success: false, error: "Appointment not found" });
  }
  
  res.json({ success: true, data: appointment });
});

router.post("/appointments", (req: Request, res: Response) => {
  const { profileId, providerName, appointmentType, title, scheduledAt, ...rest } = req.body;
  
  if (!profileId || !providerName || !title || !scheduledAt) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }
  
  const now = new Date().toISOString();
  const appointment: PatientAppointment = {
    id: `appt-${Date.now()}`,
    profileId,
    providerId: rest.providerId || null,
    providerName,
    providerSpecialty: rest.providerSpecialty || null,
    facilityName: rest.facilityName || null,
    facilityAddress: rest.facilityAddress || null,
    appointmentType: appointmentType || "routine_checkup",
    title,
    description: rest.description || null,
    scheduledAt,
    durationMinutes: rest.durationMinutes || 30,
    status: "scheduled",
    isTelehealth: rest.isTelehealth || false,
    telehealthUrl: rest.telehealthUrl || null,
    notes: rest.notes || null,
    reminderSentAt: null,
    confirmedAt: null,
    checkedInAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  
  patientAppointments.set(appointment.id, appointment);
  res.status(201).json({ success: true, data: appointment });
});

router.post("/appointments/:appointmentId/confirm", (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const appointment = patientAppointments.get(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({ success: false, error: "Appointment not found" });
  }
  
  appointment.status = "confirmed";
  appointment.confirmedAt = new Date().toISOString();
  appointment.updatedAt = new Date().toISOString();
  patientAppointments.set(appointmentId, appointment);
  
  res.json({ success: true, data: appointment });
});

router.post("/appointments/:appointmentId/cancel", (req: Request, res: Response) => {
  const { appointmentId } = req.params;
  const { reason } = req.body;
  const appointment = patientAppointments.get(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({ success: false, error: "Appointment not found" });
  }
  
  appointment.status = "cancelled";
  appointment.notes = reason ? `Cancelled: ${reason}` : appointment.notes;
  appointment.updatedAt = new Date().toISOString();
  patientAppointments.set(appointmentId, appointment);
  
  res.json({ success: true, data: appointment });
});

// ============================================
// HEALTH SUMMARY & DASHBOARD
// ============================================

router.get("/health-summary", (_req: Request, res: Response) => {
  const now = new Date();
  
  const summary = {
    id: "health-summary-001",
    profileId: "profile-self-001",
    lastUpdated: now.toISOString(),
    conditions: [
      { name: "Type 2 Diabetes", status: "active", diagnosedDate: "2022-03-15" },
      { name: "Hypertension", status: "active", diagnosedDate: "2021-08-22" },
      { name: "Seasonal Allergies", status: "managed", diagnosedDate: "2015-04-10" },
    ],
    medications: [
      { name: "Metformin", dosage: "500mg", frequency: "Twice daily", prescribedBy: "Dr. Sarah Chen" },
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily", prescribedBy: "Dr. Sarah Chen" },
      { name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime", prescribedBy: "Dr. Michael Torres" },
    ],
    allergies: [
      { allergen: "Penicillin", reaction: "Hives and swelling", severity: "moderate" },
      { allergen: "Shellfish", reaction: "Anaphylaxis", severity: "severe" },
      { allergen: "Pollen", reaction: "Sneezing, runny nose", severity: "mild" },
    ],
    vitals: {
      bloodPressure: "128/82",
      heartRate: 72,
      weight: 175,
      height: 70,
      lastChecked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    preventiveCare: [
      { name: "Annual Physical", lastDate: "2024-06-15", nextDue: "2025-06-15", status: "current" },
      { name: "Flu Vaccine", lastDate: "2024-10-20", nextDue: "2025-10-01", status: "current" },
      { name: "Colonoscopy", lastDate: "2020-03-10", nextDue: "2025-03-10", status: "due_soon" },
      { name: "Eye Exam", lastDate: "2024-01-15", nextDue: "2025-01-15", status: "due_soon" },
    ],
  };
  
  res.json({ success: true, data: summary });
});

router.get("/dashboard", (_req: Request, res: Response) => {
  const now = new Date();
  const appointments = Array.from(patientAppointments.values());
  
  const upcomingAppointments = appointments
    .filter(a => 
      new Date(a.scheduledAt) >= now && 
      !["completed", "cancelled", "no_show"].includes(a.status)
    )
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 5);
  
  const recentActivity = [
    {
      id: "activity-001",
      type: "medication",
      title: "Medication Reminder",
      description: "Time to take your Metformin 500mg",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isRead: false,
    },
    {
      id: "activity-002",
      type: "lab_result",
      title: "New Lab Results Available",
      description: "Your blood panel results are ready",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      isRead: true,
    },
    {
      id: "activity-003",
      type: "message",
      title: "Message from Dr. Smith",
      description: "Your lab results look good...",
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      isRead: false,
    },
  ];
  
  const quickStats = {
    medicationsToday: 3,
    medicationsTaken: 1,
    stepsToday: 6543,
    stepsGoal: 10000,
    waterGlasses: 5,
    waterGoal: 8,
    sleepHoursLastNight: 7.5,
  };
  
  const healthAlerts = [
    {
      id: "alert-001",
      severity: "info",
      title: "Flu Shot Due",
      description: "Your annual flu vaccination is due this month",
      actionLabel: "Schedule Now",
      actionUrl: "/appointments/new?type=vaccination",
    },
  ];
  
  res.json({
    success: true,
    data: {
      upcomingAppointments,
      recentActivity,
      quickStats,
      healthAlerts,
      lastUpdated: now.toISOString(),
    }
  });
});

export default router;
