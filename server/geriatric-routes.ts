import { Router, Request, Response } from "express";

const router = Router();

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timeOfDay: string[];
  purpose: string;
  prescribedBy: string;
  pharmacy: string;
  startDate: string;
  endDate?: string;
  stopReason?: string;
  sideEffects: string[];
  instructions: string;
  refillDate?: string;
  isActive: boolean;
}

interface Appointment {
  id: string;
  providerName: string;
  specialty: string;
  facilityName: string;
  scheduledAt: string;
  purpose: string;
  instructions?: string;
}

interface RecentChange {
  id: string;
  type: "medication" | "appointment" | "lab_result" | "document" | "vitals";
  title: string;
  description: string;
  changedAt: string;
  changedBy: string;
}

interface CaregiverNote {
  id: string;
  caregiverName: string;
  note: string;
  createdAt: string;
  priority: "low" | "normal" | "high";
  category: "medication" | "appointment" | "general" | "concern";
}

interface CaregiverProfile {
  id: string;
  name: string;
  relationship: string;
  email: string;
  phone: string;
  accessLevel: "full" | "limited" | "view_only";
  canReceiveReminders: boolean;
  canUploadDocuments: boolean;
  canPrintPacket: boolean;
  addedAt: string;
}

const sampleMedications: Medication[] = [
  {
    id: "med-1",
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice daily",
    timeOfDay: ["morning", "evening"],
    purpose: "Blood sugar control",
    prescribedBy: "Dr. Sarah Johnson",
    pharmacy: "CVS Pharmacy - Main Street",
    startDate: "2024-06-15",
    sideEffects: [],
    instructions: "Take with food",
    refillDate: "2026-02-01",
    isActive: true,
  },
  {
    id: "med-2",
    name: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily",
    timeOfDay: ["morning"],
    purpose: "Blood pressure",
    prescribedBy: "Dr. Michael Chen",
    pharmacy: "CVS Pharmacy - Main Street",
    startDate: "2024-03-01",
    sideEffects: ["Dry cough"],
    instructions: "Take in the morning",
    refillDate: "2026-01-28",
    isActive: true,
  },
  {
    id: "med-3",
    name: "Aspirin",
    dosage: "81mg",
    frequency: "Once daily",
    timeOfDay: ["morning"],
    purpose: "Heart health",
    prescribedBy: "Dr. Sarah Johnson",
    pharmacy: "Walgreens - Oak Avenue",
    startDate: "2023-01-15",
    sideEffects: [],
    instructions: "Take with breakfast",
    isActive: true,
  },
  {
    id: "med-4",
    name: "Vitamin D3",
    dosage: "2000 IU",
    frequency: "Once daily",
    timeOfDay: ["morning"],
    purpose: "Bone health",
    prescribedBy: "Dr. Sarah Johnson",
    pharmacy: "CVS Pharmacy - Main Street",
    startDate: "2024-09-01",
    sideEffects: [],
    instructions: "Take with food",
    isActive: true,
  },
  {
    id: "med-5",
    name: "Omeprazole",
    dosage: "20mg",
    frequency: "Once daily",
    timeOfDay: ["morning"],
    purpose: "Acid reflux",
    prescribedBy: "Dr. Michael Chen",
    pharmacy: "CVS Pharmacy - Main Street",
    startDate: "2024-01-10",
    endDate: "2024-08-15",
    stopReason: "Condition resolved",
    sideEffects: ["Headache"],
    instructions: "Take 30 minutes before breakfast",
    isActive: false,
  },
];

const sampleAppointments: Appointment[] = [
  {
    id: "apt-1",
    providerName: "Dr. Sarah Johnson",
    specialty: "Primary Care",
    facilityName: "City Medical Center",
    scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    purpose: "Annual checkup",
    instructions: "Bring medication list. Fasting required for blood work.",
  },
  {
    id: "apt-2",
    providerName: "Dr. Michael Chen",
    specialty: "Cardiology",
    facilityName: "Heart Health Clinic",
    scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    purpose: "Blood pressure follow-up",
    instructions: "Bring blood pressure log from home monitoring.",
  },
  {
    id: "apt-3",
    providerName: "Dr. Emily Rodriguez",
    specialty: "Ophthalmology",
    facilityName: "Vision Care Center",
    scheduledAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    purpose: "Annual eye exam",
    instructions: "Bring current glasses. Someone should drive you home.",
  },
];

const sampleRecentChanges: RecentChange[] = [
  {
    id: "change-1",
    type: "medication",
    title: "Metformin dosage adjusted",
    description: "Dosage increased from 250mg to 500mg",
    changedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    changedBy: "Dr. Sarah Johnson",
  },
  {
    id: "change-2",
    type: "lab_result",
    title: "Blood work results available",
    description: "A1C: 6.8%, Cholesterol: 185 mg/dL",
    changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    changedBy: "City Medical Lab",
  },
  {
    id: "change-3",
    type: "appointment",
    title: "New appointment scheduled",
    description: "Cardiology follow-up with Dr. Chen",
    changedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    changedBy: "Heart Health Clinic",
  },
];

const sampleCaregiverNotes: CaregiverNote[] = [
  {
    id: "note-1",
    caregiverName: "Mary Smith (Daughter)",
    note: "Dad mentioned feeling dizzy yesterday morning. Should mention to Dr. Johnson at next visit.",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    priority: "high",
    category: "concern",
  },
  {
    id: "note-2",
    caregiverName: "Mary Smith (Daughter)",
    note: "Picked up refill for Metformin. Good until February.",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    priority: "normal",
    category: "medication",
  },
  {
    id: "note-3",
    caregiverName: "John Smith (Son)",
    note: "Will drive Dad to cardiology appointment on the 31st.",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    priority: "normal",
    category: "appointment",
  },
];

const sampleCaregivers: CaregiverProfile[] = [
  {
    id: "cg-1",
    name: "Mary Smith",
    relationship: "Daughter",
    email: "mary.smith@email.com",
    phone: "(555) 123-4567",
    accessLevel: "full",
    canReceiveReminders: true,
    canUploadDocuments: true,
    canPrintPacket: true,
    addedAt: "2024-01-15",
  },
  {
    id: "cg-2",
    name: "John Smith",
    relationship: "Son",
    email: "john.smith@email.com",
    phone: "(555) 987-6543",
    accessLevel: "limited",
    canReceiveReminders: true,
    canUploadDocuments: false,
    canPrintPacket: true,
    addedAt: "2024-03-20",
  },
];

router.get("/medications", (_req: Request, res: Response) => {
  const activeMeds = sampleMedications.filter((m) => m.isActive);
  res.json({ data: activeMeds });
});

router.get("/medications/all", (_req: Request, res: Response) => {
  res.json({ data: sampleMedications });
});

router.get("/medications/today", (_req: Request, res: Response) => {
  const now = new Date();
  const currentHour = now.getHours();
  
  let timeOfDay: string;
  if (currentHour < 12) {
    timeOfDay = "morning";
  } else if (currentHour < 17) {
    timeOfDay = "afternoon";
  } else {
    timeOfDay = "evening";
  }

  const activeMeds = sampleMedications.filter((m) => m.isActive);
  const todayMeds = activeMeds.map((med) => ({
    ...med,
    scheduledTimes: med.timeOfDay,
    takenToday: med.timeOfDay.map((time) => ({
      time,
      taken: time !== timeOfDay ? true : false,
    })),
  }));

  res.json({ data: todayMeds });
});

router.post("/medications/:id/side-effects", (req: Request, res: Response) => {
  const { id } = req.params;
  const { sideEffect, notes } = req.body;
  
  console.log(`[Geriatric] Recording side effect for medication ${id}:`, { sideEffect, notes });
  
  res.json({
    success: true,
    message: "Side effect recorded",
    data: { medicationId: id, sideEffect, notes, recordedAt: new Date().toISOString() },
  });
});

router.post("/medications/:id/stop", (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, stoppedDate } = req.body;
  
  console.log(`[Geriatric] Stopping medication ${id}:`, { reason, stoppedDate });
  
  res.json({
    success: true,
    message: "Medication marked as stopped",
    data: { medicationId: id, reason, stoppedDate, recordedAt: new Date().toISOString() },
  });
});

router.get("/appointments/upcoming", (_req: Request, res: Response) => {
  res.json({ data: sampleAppointments });
});

router.get("/recent-changes", (_req: Request, res: Response) => {
  res.json({ data: sampleRecentChanges });
});

router.get("/caregiver-notes", (_req: Request, res: Response) => {
  res.json({ data: sampleCaregiverNotes });
});

router.post("/caregiver-notes", (req: Request, res: Response) => {
  const { note, priority, category } = req.body;
  
  const newNote: CaregiverNote = {
    id: `note-${Date.now()}`,
    caregiverName: "Current User",
    note,
    createdAt: new Date().toISOString(),
    priority: priority || "normal",
    category: category || "general",
  };
  
  sampleCaregiverNotes.unshift(newNote);
  
  res.json({ success: true, data: newNote });
});

router.get("/caregivers", (_req: Request, res: Response) => {
  res.json({ data: sampleCaregivers });
});

router.post("/caregivers/invite", (req: Request, res: Response) => {
  const { email, name, relationship, accessLevel } = req.body;
  
  const shareLink = `https://tabulamedica.app/caregiver-invite/${Date.now()}`;
  
  console.log(`[Geriatric] Inviting caregiver:`, { email, name, relationship, accessLevel });
  
  res.json({
    success: true,
    message: "Invitation sent",
    data: { shareLink, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() },
  });
});

router.patch("/caregivers/:id/permissions", (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  
  console.log(`[Geriatric] Updating caregiver ${id} permissions:`, updates);
  
  res.json({ success: true, message: "Permissions updated" });
});

router.delete("/caregivers/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  
  console.log(`[Geriatric] Removing caregiver ${id}`);
  
  res.json({ success: true, message: "Caregiver removed" });
});

router.post("/caregivers/:id/reminders", (req: Request, res: Response) => {
  const { id } = req.params;
  const { enableMedicationReminders, enableAppointmentReminders, reminderTime, reminderMethod } = req.body;
  
  console.log(`[Geriatric] Updating caregiver ${id} reminders:`, { enableMedicationReminders, enableAppointmentReminders, reminderTime, reminderMethod });
  
  res.json({
    success: true,
    message: "Reminder preferences updated",
    data: { caregiverId: id, enableMedicationReminders, enableAppointmentReminders, reminderTime, reminderMethod },
  });
});

router.post("/documents/upload", (req: Request, res: Response) => {
  const { documentType, fileName, description, uploadedBy } = req.body;
  
  console.log(`[Geriatric] Document upload:`, { documentType, fileName, description, uploadedBy });
  
  res.json({
    success: true,
    message: "Document uploaded successfully",
    data: {
      id: `doc-${Date.now()}`,
      documentType,
      fileName,
      description,
      uploadedBy: uploadedBy || "Caregiver",
      uploadedAt: new Date().toISOString(),
    },
  });
});

router.get("/documents", (_req: Request, res: Response) => {
  const documents = [
    {
      id: "doc-1",
      documentType: "lab_result",
      fileName: "Blood_Work_Jan2026.pdf",
      description: "Complete blood panel results",
      uploadedBy: "Mary Smith (Daughter)",
      uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "doc-2",
      documentType: "prescription",
      fileName: "Metformin_Rx.pdf",
      description: "Metformin prescription renewal",
      uploadedBy: "Dr. Sarah Johnson",
      uploadedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
  
  res.json({ data: documents });
});

router.get("/print-packet", (_req: Request, res: Response) => {
  const packet = {
    generatedAt: new Date().toISOString(),
    patient: {
      name: "Sample Patient",
      dateOfBirth: "1945-03-15",
      emergencyContact: "Mary Smith (Daughter) - (555) 123-4567",
    },
    medications: sampleMedications.filter((m) => m.isActive),
    appointments: sampleAppointments,
    allergies: ["Penicillin", "Sulfa drugs"],
    conditions: ["Type 2 Diabetes", "Hypertension", "Osteoarthritis"],
    caregivers: sampleCaregivers,
  };
  
  res.json({ data: packet });
});

export default router;
