import { Router, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const SAMPLE_PATIENT_ID = "patient-001";

function getPatientId(req: Request): string {
  const user = (req as any).user;
  return user?.claims?.sub || user?.id || SAMPLE_PATIENT_ID;
}

// Mock data for enhanced patient portal features

const mockThreads = [
  {
    id: "thread-001",
    clinicianId: "dr-001",
    clinicianName: "Dr. Sarah Johnson",
    clinicianSpecialty: "Internal Medicine",
    lastMessage: "Your lab results look good. Keep up the healthy habits!",
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
    isUrgent: false
  },
  {
    id: "thread-002",
    clinicianId: "dr-002",
    clinicianName: "Dr. Michael Chen",
    clinicianSpecialty: "Cardiology",
    lastMessage: "Please schedule a follow-up appointment for next month.",
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unreadCount: 2,
    isUrgent: false
  },
  {
    id: "thread-003",
    clinicianId: "np-001",
    clinicianName: "NP Amy Lee",
    clinicianSpecialty: "Primary Care",
    lastMessage: "Your prescription refill has been approved.",
    lastMessageAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    unreadCount: 1,
    isUrgent: false
  }
];

const mockMessages: Record<string, Array<{
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderType: "patient" | "clinician";
  content: string;
  sentAt: string;
  isRead: boolean;
}>> = {
  "thread-001": [
    { id: "msg-001", threadId: "thread-001", senderId: "dr-001", senderName: "Dr. Sarah Johnson", senderType: "clinician", content: "Good morning! I wanted to follow up on your recent visit.", sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), isRead: true },
    { id: "msg-002", threadId: "thread-001", senderId: SAMPLE_PATIENT_ID, senderName: "You", senderType: "patient", content: "Hi Dr. Johnson, thank you for checking in. I've been feeling much better.", sentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), isRead: true },
    { id: "msg-003", threadId: "thread-001", senderId: "dr-001", senderName: "Dr. Sarah Johnson", senderType: "clinician", content: "Your lab results look good. Keep up the healthy habits!", sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), isRead: true }
  ],
  "thread-002": [
    { id: "msg-004", threadId: "thread-002", senderId: "dr-002", senderName: "Dr. Michael Chen", senderType: "clinician", content: "Hello, I reviewed your recent EKG results. Everything looks stable.", sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), isRead: true },
    { id: "msg-005", threadId: "thread-002", senderId: "dr-002", senderName: "Dr. Michael Chen", senderType: "clinician", content: "Please schedule a follow-up appointment for next month.", sentAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), isRead: false }
  ],
  "thread-003": [
    { id: "msg-006", threadId: "thread-003", senderId: SAMPLE_PATIENT_ID, senderName: "You", senderType: "patient", content: "Hi, I need to request a refill for my Metformin prescription.", sentAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), isRead: true },
    { id: "msg-007", threadId: "thread-003", senderId: "np-001", senderName: "NP Amy Lee", senderType: "clinician", content: "Your prescription refill has been approved.", sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), isRead: false }
  ]
};

const mockEducationalContent = [
  {
    id: "edu-001",
    title: "Understanding Type 2 Diabetes",
    description: "Learn about managing blood sugar levels, dietary choices, and lifestyle modifications.",
    category: "Diabetes Management",
    contentType: "article",
    duration: "8 min read",
    relevantConditions: ["Diabetes Type 2"],
    isCompleted: false,
    progress: 0
  },
  {
    id: "edu-002",
    title: "Heart-Healthy Diet Tips",
    description: "Discover foods that support cardiovascular health and reduce heart disease risk.",
    category: "Nutrition",
    contentType: "video",
    duration: "12 min",
    relevantConditions: ["Hypertension", "Heart Disease"],
    isCompleted: true,
    progress: 100
  },
  {
    id: "edu-003",
    title: "Exercise Safely with Diabetes",
    description: "Guidelines for staying active while managing blood sugar levels.",
    category: "Physical Activity",
    contentType: "article",
    duration: "6 min read",
    relevantConditions: ["Diabetes Type 2"],
    isCompleted: false,
    progress: 50
  },
  {
    id: "edu-004",
    title: "Medication Adherence: Why It Matters",
    description: "Understanding the importance of taking medications as prescribed.",
    category: "Medication Management",
    contentType: "interactive",
    duration: "10 min",
    relevantConditions: ["All"],
    isCompleted: false,
    progress: 0
  },
  {
    id: "edu-005",
    title: "Blood Pressure Monitoring at Home",
    description: "How to accurately measure and track your blood pressure.",
    category: "Self-Care",
    contentType: "video",
    duration: "5 min",
    relevantConditions: ["Hypertension"],
    isCompleted: false,
    progress: 0
  }
];

const mockAppointments = [
  {
    id: "apt-001",
    clinicianName: "Dr. Sarah Johnson",
    clinicianSpecialty: "Internal Medicine",
    appointmentType: "Follow-up Visit",
    scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 30,
    location: "Main Clinic - Room 204",
    status: "confirmed",
    reminderSent: true,
    hasQuestionnaire: true,
    questionnaireCompleted: false,
    notes: "Bring your recent glucose log"
  },
  {
    id: "apt-002",
    clinicianName: "Dr. Michael Chen",
    clinicianSpecialty: "Cardiology",
    appointmentType: "Annual Checkup",
    scheduledAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 45,
    location: "Cardiology Center - Suite 110",
    status: "scheduled",
    reminderSent: false,
    hasQuestionnaire: true,
    questionnaireCompleted: false,
    notes: null
  },
  {
    id: "apt-003",
    clinicianName: "Lab Services",
    clinicianSpecialty: "Laboratory",
    appointmentType: "Blood Work",
    scheduledAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
    duration: 15,
    location: "Lab Building - 1st Floor",
    status: "confirmed",
    reminderSent: true,
    hasQuestionnaire: false,
    questionnaireCompleted: false,
    notes: "Fasting required - no food for 12 hours before"
  }
];

const mockQuestionnaires: Record<string, {
  id: string;
  appointmentId: string;
  title: string;
  questions: Array<{
    id: string;
    text: string;
    type: "text" | "multiple_choice" | "scale" | "boolean";
    options?: string[];
    required: boolean;
  }>;
}> = {
  "apt-001": {
    id: "quest-001",
    appointmentId: "apt-001",
    title: "Pre-Visit Health Check",
    questions: [
      { id: "q1", text: "How would you rate your overall health since your last visit? (1-10)", type: "scale", required: true },
      { id: "q2", text: "Have you experienced any new symptoms?", type: "boolean", required: true },
      { id: "q3", text: "If yes, please describe your symptoms:", type: "text", required: false },
      { id: "q4", text: "Have you been taking your medications as prescribed?", type: "multiple_choice", options: ["Always", "Most of the time", "Sometimes", "Rarely"], required: true },
      { id: "q5", text: "Any concerns you'd like to discuss during your visit?", type: "text", required: false }
    ]
  },
  "apt-002": {
    id: "quest-002",
    appointmentId: "apt-002",
    title: "Cardiovascular Health Assessment",
    questions: [
      { id: "q1", text: "Have you experienced chest pain or discomfort?", type: "boolean", required: true },
      { id: "q2", text: "Have you had shortness of breath during activities?", type: "boolean", required: true },
      { id: "q3", text: "How would you rate your energy level? (1-10)", type: "scale", required: true },
      { id: "q4", text: "How many times per week do you exercise?", type: "multiple_choice", options: ["0", "1-2", "3-4", "5+"], required: true },
      { id: "q5", text: "List any new medications or supplements:", type: "text", required: false }
    ]
  }
};

const mockPrescriptions = [
  {
    id: "rx-001",
    medicationName: "Metformin",
    genericName: "Metformin Hydrochloride",
    dosage: "500mg",
    frequency: "Twice daily with meals",
    prescriberName: "Dr. Sarah Johnson",
    pharmacyName: "CVS Pharmacy",
    pharmacyPhone: "(555) 123-4567",
    lastFilledDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    refillsRemaining: 2,
    daysSupply: 30,
    daysUntilRefill: 5,
    status: "active",
    canRequestRefill: true,
    pendingRefillRequest: false,
    instructions: "Take with food to reduce stomach upset"
  },
  {
    id: "rx-002",
    medicationName: "Lisinopril",
    genericName: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily in the morning",
    prescriberName: "Dr. Sarah Johnson",
    pharmacyName: "CVS Pharmacy",
    pharmacyPhone: "(555) 123-4567",
    lastFilledDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    refillsRemaining: 5,
    daysSupply: 30,
    daysUntilRefill: 20,
    status: "active",
    canRequestRefill: true,
    pendingRefillRequest: false,
    instructions: "Monitor blood pressure regularly"
  },
  {
    id: "rx-003",
    medicationName: "Atorvastatin",
    genericName: "Atorvastatin Calcium",
    dosage: "20mg",
    frequency: "Once daily at bedtime",
    prescriberName: "Dr. Michael Chen",
    pharmacyName: "Walgreens",
    pharmacyPhone: "(555) 987-6543",
    lastFilledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    refillsRemaining: 0,
    daysSupply: 30,
    daysUntilRefill: 25,
    status: "active",
    canRequestRefill: false,
    pendingRefillRequest: true,
    instructions: "Take in the evening for best effect"
  }
];

// Messaging
router.get("/messaging/threads", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  await logPhiAccess({ action: "read", resourceType: "MessageThread", userId: patientId, patientId, details: "Accessed messaging threads" });
  res.json(mockThreads);
});

router.get("/messaging/threads/:threadId/messages", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  const { threadId } = req.params;
  await logPhiAccess({ action: "read", resourceType: "Message", userId: patientId, patientId, details: `Read messages in thread ${threadId}` });
  res.json(mockMessages[threadId] || []);
});

router.post("/messaging/threads/:threadId/messages", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  const { threadId } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Message content is required" });
  
  await logPhiAccess({ action: "write", resourceType: "Message", userId: patientId, patientId, details: `Sent message in thread ${threadId}` });
  
  const newMessage = {
    id: `msg-${Date.now()}`,
    threadId,
    senderId: patientId,
    senderName: "You",
    senderType: "patient" as const,
    content,
    sentAt: new Date().toISOString(),
    isRead: true
  };
  if (!mockMessages[threadId]) mockMessages[threadId] = [];
  mockMessages[threadId].push(newMessage);
  res.json(newMessage);
});

// Education
router.get("/education", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  await logPhiAccess({ action: "read", resourceType: "EducationalContent", userId: patientId, details: "Accessed educational content" });
  res.json({
    content: mockEducationalContent,
    categories: Array.from(new Set(mockEducationalContent.map(c => c.category))),
    conditions: Array.from(new Set(mockEducationalContent.flatMap(c => c.relevantConditions).filter(c => c !== "All")))
  });
});

router.post("/education/:contentId/progress", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  const { contentId } = req.params;
  const { progress } = req.body;
  await logPhiAccess({ action: "write", resourceType: "EducationalContent", userId: patientId, details: `Updated progress for ${contentId}` });
  const content = mockEducationalContent.find(c => c.id === contentId);
  if (content) { content.progress = progress; content.isCompleted = progress >= 100; }
  res.json({ success: true });
});

// Appointments
router.get("/appointments", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  await logPhiAccess({ action: "read", resourceType: "Appointment", userId: patientId, patientId, details: "Accessed appointments" });
  res.json(mockAppointments);
});

router.get("/appointments/:appointmentId/questionnaire", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  const { appointmentId } = req.params;
  await logPhiAccess({ action: "read", resourceType: "Questionnaire", userId: patientId, patientId, details: `Accessed questionnaire for ${appointmentId}` });
  const q = mockQuestionnaires[appointmentId];
  if (!q) return res.status(404).json({ error: "Questionnaire not found" });
  res.json(q);
});

router.post("/appointments/:appointmentId/questionnaire", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  const { appointmentId } = req.params;
  const { responses } = req.body;
  if (!responses) return res.status(400).json({ error: "Responses required" });
  await logPhiAccess({ action: "write", resourceType: "Questionnaire", userId: patientId, patientId, details: `Submitted questionnaire for ${appointmentId}` });
  const apt = mockAppointments.find(a => a.id === appointmentId);
  if (apt) apt.questionnaireCompleted = true;
  res.json({ success: true, message: "Questionnaire submitted successfully." });
});

// Prescriptions
router.get("/prescriptions", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  await logPhiAccess({ action: "read", resourceType: "Prescription", userId: patientId, patientId, details: "Accessed prescriptions" });
  res.json(mockPrescriptions);
});

router.post("/prescriptions/:prescriptionId/refill", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  const { prescriptionId } = req.params;
  await logPhiAccess({ action: "write", resourceType: "RefillRequest", userId: patientId, patientId, details: `Requested refill for ${prescriptionId}` });
  const rx = mockPrescriptions.find(p => p.id === prescriptionId);
  if (!rx) return res.status(404).json({ error: "Prescription not found" });
  if (!rx.canRequestRefill) return res.status(400).json({ error: "Cannot request refill at this time" });
  rx.pendingRefillRequest = true;
  res.json({ success: true, message: "Refill request submitted. Your care team will process it within 24-48 hours." });
});

export default router;
