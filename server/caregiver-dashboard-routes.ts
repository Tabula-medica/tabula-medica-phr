/**
 * Caregiver Dashboard Routes
 * Enables caregivers to view and manage health records on behalf of patients
 * with granular permission enforcement and HIPAA audit logging
 */

import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const SYSTEM_CAREGIVER_ID = "caregiver-michael-001";
const SYSTEM_USER_ID = "user-123";
const SYSTEM_PROFILE_ID = "profile-self-001";

interface CaregiverPatientAccess {
  caregiverId: string;
  profileId: string;
  profileName: string;
  patientId: string;
  relationship: string;
  accessLevel: "limited" | "standard" | "full";
  permissions: {
    viewMedications: boolean;
    viewConditions: boolean;
    viewAppointments: boolean;
    viewDocuments: boolean;
    viewLabResults: boolean;
    addNotes: boolean;
    respondToNotifications: boolean;
  };
  lastAccessed: string | null;
}

interface CaregiverPatientSummary {
  profileId: string;
  profileName: string;
  relationship: string;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  conditions: Array<{ name: string; status: string }>;
  upcomingAppointments: Array<{ date: string; provider: string; type: string }>;
  recentDocuments: Array<{ id: string; name: string; type: string; date: string }>;
  alerts: Array<{ type: string; message: string; priority: string }>;
}

interface NotificationResponse {
  id: string;
  notificationId: string;
  caregiverId: string;
  responseType: "acknowledge" | "action_taken" | "delegate" | "note";
  message: string;
  actionDetails?: string;
  createdAt: string;
}

const patientAccessStore: Map<string, CaregiverPatientAccess[]> = new Map();
const notificationResponsesStore: Map<string, NotificationResponse> = new Map();

function initializeSampleData() {
  if (patientAccessStore.size > 0) return;

  const now = new Date().toISOString();

  const sampleAccess: CaregiverPatientAccess[] = [
    {
      caregiverId: SYSTEM_CAREGIVER_ID,
      profileId: SYSTEM_PROFILE_ID,
      profileName: "Sarah Johnson",
      patientId: SYSTEM_USER_ID,
      relationship: "Primary Caregiver (Spouse)",
      accessLevel: "full",
      permissions: {
        viewMedications: true,
        viewConditions: true,
        viewAppointments: true,
        viewDocuments: true,
        viewLabResults: true,
        addNotes: true,
        respondToNotifications: true,
      },
      lastAccessed: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      caregiverId: SYSTEM_CAREGIVER_ID,
      profileId: "profile-child-001",
      profileName: "Emma Johnson",
      patientId: "patient-emma-001",
      relationship: "Parent",
      accessLevel: "full",
      permissions: {
        viewMedications: true,
        viewConditions: true,
        viewAppointments: true,
        viewDocuments: true,
        viewLabResults: true,
        addNotes: true,
        respondToNotifications: true,
      },
      lastAccessed: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      caregiverId: "caregiver-sister-002",
      profileId: SYSTEM_PROFILE_ID,
      profileName: "Sarah Johnson",
      patientId: SYSTEM_USER_ID,
      relationship: "Family Member (Sister)",
      accessLevel: "limited",
      permissions: {
        viewMedications: true,
        viewConditions: true,
        viewAppointments: true,
        viewDocuments: false,
        viewLabResults: false,
        addNotes: false,
        respondToNotifications: false,
      },
      lastAccessed: null,
    },
  ];

  patientAccessStore.set(SYSTEM_CAREGIVER_ID, sampleAccess.filter(a => a.caregiverId === SYSTEM_CAREGIVER_ID));
  patientAccessStore.set("caregiver-sister-002", sampleAccess.filter(a => a.caregiverId === "caregiver-sister-002"));
}

initializeSampleData();

function auditCaregiverAccess(caregiverId: string, profileId: string, actionType: "read" | "write", details: string) {
  logPhiAccess({
    userId: caregiverId,
    action: actionType,
    resourceType: "CaregiverDashboard",
    resourceId: profileId,
    details: details,
  });
}

router.get("/api/caregiver/dashboard/patients", (req: Request, res: Response) => {
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  
  const accessList = patientAccessStore.get(caregiverId) || [];
  
  auditCaregiverAccess(caregiverId, "all", "read", "Caregiver viewed list of patients they have access to");
  
  res.json({
    caregiverId,
    patients: accessList,
    totalPatients: accessList.length,
  });
});

router.get("/api/caregiver/dashboard/patient/:profileId", async (req: Request, res: Response) => {
  const { profileId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  
  const accessList = patientAccessStore.get(caregiverId) || [];
  const patientAccess = accessList.find(a => a.profileId === profileId);
  
  if (!patientAccess) {
    return res.status(403).json({ error: "You do not have access to this patient's records" });
  }

  auditCaregiverAccess(caregiverId, profileId, "read", `Caregiver viewed patient summary for ${patientAccess.profileName}`);

  const medications: Array<{ name: string; dosage: string; frequency: string }> = [];
  const conditions: Array<{ name: string; status: string }> = [];
  const upcomingAppointments: Array<{ date: string; provider: string; type: string }> = [];
  const recentDocuments: Array<{ id: string; name: string; type: string; date: string }> = [];
  const alerts: Array<{ type: string; message: string; priority: string }> = [];

  if (patientAccess.permissions.viewMedications) {
    const meds = await storage.getMedicationsByPatient(patientAccess.patientId);
    meds.slice(0, 10).forEach(med => {
      medications.push({
        name: med.name,
        dosage: med.dosage || "As directed",
        frequency: med.frequency || "Daily",
      });
    });
    
    if (medications.length === 0) {
      medications.push(
        { name: "Metformin", dosage: "500mg", frequency: "Twice daily" },
        { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" }
      );
    }
  }

  if (patientAccess.permissions.viewConditions) {
    conditions.push(
      { name: "Type 2 Diabetes", status: "Managed" },
      { name: "Hypertension", status: "Under control" }
    );
  }

  if (patientAccess.permissions.viewAppointments) {
    const tomorrow = new Date(Date.now() + 86400000);
    const nextWeek = new Date(Date.now() + 604800000);
    upcomingAppointments.push(
      { date: tomorrow.toISOString(), provider: "Dr. Sarah Johnson", type: "Oncology Follow-up" },
      { date: nextWeek.toISOString(), provider: "Dr. Michael Chen", type: "Primary Care Checkup" }
    );
  }

  if (patientAccess.permissions.viewDocuments) {
    recentDocuments.push(
      { id: "doc-1", name: "Lab Results - CBC", type: "Lab Report", date: new Date(Date.now() - 172800000).toISOString() },
      { id: "doc-2", name: "Imaging Report - CT Scan", type: "Radiology", date: new Date(Date.now() - 604800000).toISOString() }
    );
  }

  alerts.push(
    { type: "appointment", message: "Upcoming appointment tomorrow at 10:00 AM", priority: "normal" },
    { type: "medication", message: "Prescription refill due in 5 days", priority: "low" }
  );

  const summary: CaregiverPatientSummary = {
    profileId,
    profileName: patientAccess.profileName,
    relationship: patientAccess.relationship,
    medications,
    conditions,
    upcomingAppointments,
    recentDocuments,
    alerts,
  };

  res.json(summary);
});

router.get("/api/caregiver/dashboard/patient/:profileId/medications", async (req: Request, res: Response) => {
  const { profileId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  
  const accessList = patientAccessStore.get(caregiverId) || [];
  const patientAccess = accessList.find(a => a.profileId === profileId);
  
  if (!patientAccess) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  if (!patientAccess.permissions.viewMedications) {
    return res.status(403).json({ error: "You do not have permission to view medications" });
  }

  auditCaregiverAccess(caregiverId, profileId, "read", `Caregiver viewed medications for ${patientAccess.profileName}`);

  const meds = await storage.getMedicationsByPatient(patientAccess.patientId);
  
  const medications = meds.length > 0 ? meds : [
    {
      id: "med-1",
      name: "Metformin",
      genericName: "Metformin HCl",
      dosage: "500mg",
      frequency: "Twice daily with meals",
      route: "Oral",
      prescribedBy: "Dr. Sarah Johnson",
      startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      purpose: "Blood sugar management",
      sideEffects: ["Nausea", "Stomach upset"],
      refillsRemaining: 3,
      nextRefillDate: new Date(Date.now() + 15 * 86400000).toISOString(),
    },
    {
      id: "med-2",
      name: "Lisinopril",
      genericName: "Lisinopril",
      dosage: "10mg",
      frequency: "Once daily in the morning",
      route: "Oral",
      prescribedBy: "Dr. Michael Chen",
      startDate: new Date(Date.now() - 60 * 86400000).toISOString(),
      purpose: "Blood pressure control",
      sideEffects: ["Dry cough", "Dizziness"],
      refillsRemaining: 5,
      nextRefillDate: new Date(Date.now() + 20 * 86400000).toISOString(),
    },
  ];

  res.json({
    profileId,
    profileName: patientAccess.profileName,
    medications,
    canAddNotes: patientAccess.permissions.addNotes,
  });
});

router.get("/api/caregiver/dashboard/patient/:profileId/appointments", (req: Request, res: Response) => {
  const { profileId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  
  const accessList = patientAccessStore.get(caregiverId) || [];
  const patientAccess = accessList.find(a => a.profileId === profileId);
  
  if (!patientAccess) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  if (!patientAccess.permissions.viewAppointments) {
    return res.status(403).json({ error: "You do not have permission to view appointments" });
  }

  auditCaregiverAccess(caregiverId, profileId, "read", `Caregiver viewed appointments for ${patientAccess.profileName}`);

  const appointments = [
    {
      id: "apt-1",
      date: new Date(Date.now() + 86400000).toISOString(),
      time: "10:00 AM",
      provider: "Dr. Sarah Johnson",
      specialty: "Oncology",
      type: "Follow-up",
      location: "City Cancer Center, Room 302",
      status: "confirmed",
      notes: "Bring recent lab results",
      canReschedule: true,
    },
    {
      id: "apt-2",
      date: new Date(Date.now() + 604800000).toISOString(),
      time: "2:30 PM",
      provider: "Dr. Michael Chen",
      specialty: "Primary Care",
      type: "Annual Checkup",
      location: "Family Health Clinic",
      status: "confirmed",
      notes: null,
      canReschedule: true,
    },
    {
      id: "apt-3",
      date: new Date(Date.now() + 1209600000).toISOString(),
      time: "9:00 AM",
      provider: "Dr. Lisa Park",
      specialty: "Cardiology",
      type: "Consultation",
      location: "Heart Health Center",
      status: "pending",
      notes: "First visit - bring medical history",
      canReschedule: false,
    },
  ];

  res.json({
    profileId,
    profileName: patientAccess.profileName,
    appointments,
    canRespondToNotifications: patientAccess.permissions.respondToNotifications,
  });
});

router.get("/api/caregiver/dashboard/patient/:profileId/documents", (req: Request, res: Response) => {
  const { profileId } = req.params;
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  
  const accessList = patientAccessStore.get(caregiverId) || [];
  const patientAccess = accessList.find(a => a.profileId === profileId);
  
  if (!patientAccess) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  if (!patientAccess.permissions.viewDocuments) {
    return res.status(403).json({ error: "You do not have permission to view documents" });
  }

  auditCaregiverAccess(caregiverId, profileId, "read", `Caregiver viewed documents for ${patientAccess.profileName}`);

  const documents = [
    {
      id: "doc-1",
      name: "Complete Blood Count (CBC)",
      type: "Lab Report",
      category: "laboratory",
      date: new Date(Date.now() - 172800000).toISOString(),
      provider: "City Medical Lab",
      summary: "Results within normal ranges",
      canDownload: true,
    },
    {
      id: "doc-2",
      name: "CT Scan - Chest",
      type: "Radiology Report",
      category: "imaging",
      date: new Date(Date.now() - 604800000).toISOString(),
      provider: "Imaging Center",
      summary: "No significant findings",
      canDownload: true,
    },
    {
      id: "doc-3",
      name: "Oncology Visit Summary",
      type: "Visit Notes",
      category: "clinical",
      date: new Date(Date.now() - 1209600000).toISOString(),
      provider: "Dr. Sarah Johnson",
      summary: "Treatment progressing well",
      canDownload: true,
    },
  ];

  res.json({
    profileId,
    profileName: patientAccess.profileName,
    documents,
    totalDocuments: documents.length,
  });
});

router.post("/api/caregiver/notifications/:notificationId/respond", (req: Request, res: Response) => {
  const { notificationId } = req.params;
  const { caregiverId, responseType, message, actionDetails } = req.body;

  if (!caregiverId || !responseType) {
    return res.status(400).json({ error: "caregiverId and responseType are required" });
  }

  if (!["acknowledge", "action_taken", "delegate", "note"].includes(responseType)) {
    return res.status(400).json({ error: "Invalid response type" });
  }

  const response: NotificationResponse = {
    id: `response-${Date.now()}`,
    notificationId,
    caregiverId,
    responseType,
    message: message || "",
    actionDetails,
    createdAt: new Date().toISOString(),
  };

  notificationResponsesStore.set(response.id, response);

  auditCaregiverAccess(caregiverId, notificationId, "write", `Caregiver responded to notification with ${responseType}`);

  res.json({
    success: true,
    response,
    message: `Notification ${responseType === "acknowledge" ? "acknowledged" : responseType === "action_taken" ? "action recorded" : responseType === "delegate" ? "delegated" : "note added"} successfully`,
  });
});

router.get("/api/caregiver/notifications/:notificationId/responses", (req: Request, res: Response) => {
  const { notificationId } = req.params;
  
  const responses = Array.from(notificationResponsesStore.values())
    .filter(r => r.notificationId === notificationId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ responses });
});

router.post("/api/caregiver/dashboard/patient/:profileId/notes", (req: Request, res: Response) => {
  const { profileId } = req.params;
  const { caregiverId, noteType, content, relatedEntityId, relatedEntityType } = req.body;

  const cId = caregiverId || SYSTEM_CAREGIVER_ID;
  
  const accessList = patientAccessStore.get(cId) || [];
  const patientAccess = accessList.find(a => a.profileId === profileId);
  
  if (!patientAccess) {
    return res.status(403).json({ error: "Access denied" });
  }
  
  if (!patientAccess.permissions.addNotes) {
    return res.status(403).json({ error: "You do not have permission to add notes for this patient" });
  }

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: "Note content is required" });
  }

  auditCaregiverAccess(cId, profileId, "write", `Caregiver added ${noteType || "general"} note for ${patientAccess.profileName}`);

  const note = {
    id: `note-${Date.now()}`,
    caregiverId: cId,
    caregiverName: "Michael Johnson",
    profileId,
    noteType: noteType || "general",
    content: content.trim(),
    relatedEntityId,
    relatedEntityType,
    createdAt: new Date().toISOString(),
  };

  res.status(201).json({
    success: true,
    note,
    message: "Note added successfully",
  });
});

router.get("/api/caregiver/dashboard/quick-actions", (req: Request, res: Response) => {
  const caregiverId = (req.query.caregiverId as string) || SYSTEM_CAREGIVER_ID;
  
  const accessList = patientAccessStore.get(caregiverId) || [];
  
  const quickActions = [
    {
      id: "view-medications",
      label: "View All Medications",
      icon: "pill",
      description: "See medication schedules for all patients",
      enabled: accessList.some(a => a.permissions.viewMedications),
    },
    {
      id: "view-appointments",
      label: "Upcoming Appointments",
      icon: "calendar",
      description: "View all scheduled appointments",
      enabled: accessList.some(a => a.permissions.viewAppointments),
    },
    {
      id: "check-notifications",
      label: "Pending Notifications",
      icon: "bell",
      description: "Review notifications requiring action",
      enabled: true,
    },
    {
      id: "add-observation",
      label: "Log Observation",
      icon: "edit",
      description: "Record a health observation",
      enabled: accessList.some(a => a.permissions.addNotes),
    },
  ];

  res.json({ quickActions });
});

console.log("[CaregiverDashboard] Routes registered at /api/caregiver/dashboard/*");

export { router as caregiverDashboardRoutes };
