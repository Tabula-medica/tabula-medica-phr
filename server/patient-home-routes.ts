import { Router, Request, Response } from "express";
import { storage } from "./storage";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

async function getSamplePatientId(): Promise<string> {
  const patients = await storage.getPatients();
  return patients[0]?.id || "patient-default";
}

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const userId = user?.claims?.sub || (await getSamplePatientId());

    logPhiAccess({
      userId,
      patientId: userId,
      resourceType: "PatientHomeDashboard",
      action: "read",
      details: "Retrieved personalized patient dashboard",
    });

    const patients = await storage.getPatients();
    const patient = patients.find((p) => p.id === userId) || patients[0];
    const patientId = patient?.id || userId;

    const medications = await storage.getMedicationsByPatient(patientId);
    const allergies = await storage.getAllergiesByPatient(patientId);
    const appointments = await storage.getUpcomingAppointments();
    const records = await storage.getMedicalRecordsByPatient(patientId);

    const conditions = records
      .filter((r) => r.type === "diagnosis")
      .map((r) => ({
        id: r.id,
        name: r.title,
        status: r.status === "active" ? "active" : r.status === "resolved" ? "resolved" : "inactive",
        onsetDate: r.date,
      }));

    const recentDocuments = records.slice(0, 5).map((r, index) => ({
      id: r.id,
      name: r.title,
      type: r.type.charAt(0).toUpperCase() + r.type.slice(1).replace("_", " "),
      date: r.date,
      provider: r.provider,
      hasAiSummary: index % 2 === 0,
      aiSummaryPreview:
        index % 2 === 0
          ? "Key findings include normal vital signs and routine follow-up recommended."
          : undefined,
    }));

    const mappedMedications = medications.map((m) => ({
      id: m.id,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      status: m.status,
      refillsRemaining: m.refillsRemaining,
    }));

    const mappedAllergies = allergies.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      severity: a.severity,
      reaction: a.reaction,
    }));

    const upcomingAppointments = appointments
      .filter((a) => a.patientId === patientId && a.status === "scheduled")
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        title: a.title,
        provider: a.provider,
        facility: a.facility,
        scheduledAt: a.scheduledAt,
        type: a.type,
        status: a.status,
      }));

    const alerts = generateAlerts(mappedMedications, upcomingAppointments);

    const completionPercentage = calculateProfileCompletion(
      conditions.length,
      mappedMedications.length,
      mappedAllergies.length
    );

    res.json({
      patient: {
        name: patient ? `${patient.firstName} ${patient.lastName}` : "Patient",
        profilePhoto: patient?.avatarUrl,
        lastSync: new Date().toISOString(),
      },
      conditions,
      medications: mappedMedications,
      allergies: mappedAllergies,
      recentDocuments,
      upcomingAppointments,
      alerts,
      healthScore: 78,
      completionPercentage,
    });
  } catch (error) {
    console.error("[PatientHome] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

function generateAlerts(
  medications: Array<{ refillsRemaining?: number; name: string }>,
  appointments: Array<{ scheduledAt: string; title: string }>
): Array<{
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  createdAt: string;
  read: boolean;
}> {
  const alerts: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    priority: string;
    createdAt: string;
    read: boolean;
  }> = [];

  medications.forEach((med, i) => {
    if (med.refillsRemaining !== undefined && med.refillsRemaining <= 2) {
      alerts.push({
        id: `med-alert-${i}`,
        type: "medication",
        title: "Medication Refill Needed",
        message: `${med.name} has ${med.refillsRemaining} refill(s) remaining.`,
        priority: med.refillsRemaining === 0 ? "high" : "medium",
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  });

  appointments.forEach((apt, i) => {
    const aptDate = new Date(apt.scheduledAt);
    const now = new Date();
    const daysUntil = Math.floor((aptDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntil <= 3 && daysUntil >= 0) {
      alerts.push({
        id: `apt-alert-${i}`,
        type: "appointment",
        title: "Upcoming Appointment",
        message: `${apt.title} is ${daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}.`,
        priority: daysUntil === 0 ? "high" : "low",
        createdAt: new Date().toISOString(),
        read: false,
      });
    }
  });

  if (alerts.length === 0) {
    alerts.push({
      id: "welcome-alert",
      type: "general",
      title: "Welcome to Tabula Medica",
      message: "Connect your health records to see your complete medical history.",
      priority: "low",
      createdAt: new Date().toISOString(),
      read: true,
    });
  }

  return alerts.slice(0, 10);
}

function calculateProfileCompletion(
  conditionsCount: number,
  medicationsCount: number,
  allergiesCount: number
): number {
  let score = 20;

  if (conditionsCount > 0) score += 20;
  if (medicationsCount > 0) score += 20;
  if (allergiesCount > 0) score += 20;

  score += Math.min(20, conditionsCount * 5 + medicationsCount * 5 + allergiesCount * 5);

  return Math.min(100, score);
}

export default router;
