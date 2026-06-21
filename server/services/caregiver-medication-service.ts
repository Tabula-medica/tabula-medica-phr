import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";
import { medicationAdherenceService, MedicationReminder, AdherenceLog } from "./medication-adherence-service";
import { analyzeMedicationInteractions, DrugInteractionAnalysis } from "./aiDrugInteractionService";
import { checkDrugInteractions } from "../pharmacy-ai";
import { storage } from "../storage";

function hashIdentifier(id: string): string {
  return id.substring(0, 8) + "***";
}

export interface CaregiverMedicationSchedule {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: "once_daily" | "twice_daily" | "three_times_daily" | "four_times_daily" | "weekly" | "as_needed" | "custom";
  scheduledTimes: string[];
  daysOfWeek?: number[];
  instructions?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  notificationSettings: {
    enablePush: boolean;
    enableSms: boolean;
    enableEmail: boolean;
    advanceMinutes: number;
    caregiverAlert: boolean;
    missedDoseAlert: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CaregiverMedicationLog {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  scheduleId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  actualTime: string;
  status: "administered" | "refused" | "skipped" | "partial" | "late";
  notes?: string;
  sideEffects?: string[];
  patientCondition?: "normal" | "drowsy" | "nauseous" | "discomfort" | "other";
  witnessedBy?: string;
  createdAt: string;
}

export interface RefillRequestData {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  medicationId: string;
  medicationName: string;
  prescriptionId?: string;
  pharmacyId?: string;
  pharmacyName?: string;
  status: "pending" | "submitted" | "processing" | "approved" | "denied" | "ready" | "completed";
  requestedAt: string;
  notes?: string;
  urgency: "routine" | "urgent" | "emergency";
  deliveryPreference: "pickup" | "delivery" | "mail";
  updatedAt: string;
}

export interface MedicationInteractionWarning {
  id: string;
  patientId: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  medication1: string;
  medication2: string;
  description: string;
  recommendation: string;
  detectedAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

const schedules = new Map<string, CaregiverMedicationSchedule>();
const medicationLogs = new Map<string, CaregiverMedicationLog>();
const refillRequests = new Map<string, RefillRequestData>();
const interactionWarnings = new Map<string, MedicationInteractionWarning>();

class CaregiverMedicationService {
  createSchedule(
    patientId: string,
    caregiverId: string,
    caregiverName: string,
    data: Omit<CaregiverMedicationSchedule, "id" | "patientId" | "caregiverId" | "caregiverName" | "createdAt" | "updatedAt">
  ): CaregiverMedicationSchedule {
    const id = `sched-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const schedule: CaregiverMedicationSchedule = {
      id,
      patientId,
      caregiverId,
      caregiverName,
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    schedules.set(id, schedule);

    logPhiAccess({
      action: "write",
      resourceType: "CaregiverMedicationSchedule",
      patientId,
      userId: caregiverId,
      resourceId: id,
      details: `Caregiver created medication schedule for ${data.medicationName}`,
    });

    console.log(`[CaregiverMedication] Schedule created: ${id} for patient ${hashIdentifier(patientId)}`);

    return schedule;
  }

  getPatientSchedules(patientId: string, caregiverId: string): CaregiverMedicationSchedule[] {
    logPhiAccess({
      action: "read",
      resourceType: "CaregiverMedicationSchedule",
      patientId,
      userId: caregiverId,
      details: "Retrieved medication schedules",
    });

    return Array.from(schedules.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  updateSchedule(
    scheduleId: string,
    caregiverId: string,
    updates: Partial<CaregiverMedicationSchedule>
  ): CaregiverMedicationSchedule | null {
    const schedule = schedules.get(scheduleId);
    if (!schedule) return null;

    const updated: CaregiverMedicationSchedule = {
      ...schedule,
      ...updates,
      id: schedule.id,
      patientId: schedule.patientId,
      updatedAt: new Date().toISOString(),
    };

    schedules.set(scheduleId, updated);

    logPhiAccess({
      action: "write",
      resourceType: "CaregiverMedicationSchedule",
      patientId: schedule.patientId,
      userId: caregiverId,
      resourceId: scheduleId,
      details: "Updated medication schedule",
    });

    return updated;
  }

  deleteSchedule(scheduleId: string, caregiverId: string): boolean {
    const schedule = schedules.get(scheduleId);
    if (!schedule) return false;

    logPhiAccess({
      action: "write",
      resourceType: "CaregiverMedicationSchedule",
      patientId: schedule.patientId,
      userId: caregiverId,
      resourceId: scheduleId,
      details: "Deleted medication schedule",
    });

    return schedules.delete(scheduleId);
  }

  logMedicationIntake(
    patientId: string,
    caregiverId: string,
    caregiverName: string,
    data: Omit<CaregiverMedicationLog, "id" | "patientId" | "caregiverId" | "caregiverName" | "createdAt">
  ): CaregiverMedicationLog {
    const id = `log-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const log: CaregiverMedicationLog = {
      id,
      patientId,
      caregiverId,
      caregiverName,
      ...data,
      createdAt: now,
    };

    medicationLogs.set(id, log);

    medicationAdherenceService.logAdherence(patientId, {
      patientId,
      medicationId: data.medicationId,
      reminderId: data.scheduleId,
      scheduledTime: data.scheduledTime,
      actualTime: data.actualTime,
      status: this.mapLogStatus(data.status),
      notes: data.notes,
      sideEffects: data.sideEffects,
    }).catch(console.error);

    logPhiAccess({
      action: "write",
      resourceType: "CaregiverMedicationLog",
      patientId,
      userId: caregiverId,
      resourceId: id,
      details: `Logged medication: ${data.medicationName} - ${data.status}`,
    });

    console.log(`[CaregiverMedication] Intake logged: ${id} - ${data.status}`);

    return log;
  }

  private mapLogStatus(status: CaregiverMedicationLog["status"]): AdherenceLog["status"] {
    switch (status) {
      case "administered": return "taken";
      case "refused": return "skipped";
      case "skipped": return "skipped";
      case "partial": return "taken";
      case "late": return "late";
      default: return "taken";
    }
  }

  getMedicationLogs(
    patientId: string,
    caregiverId: string,
    options?: { startDate?: string; endDate?: string; medicationId?: string; limit?: number }
  ): CaregiverMedicationLog[] {
    logPhiAccess({
      action: "read",
      resourceType: "CaregiverMedicationLog",
      patientId,
      userId: caregiverId,
      details: "Retrieved medication logs",
    });

    let logs = Array.from(medicationLogs.values())
      .filter(l => l.patientId === patientId);

    if (options?.medicationId) {
      logs = logs.filter(l => l.medicationId === options.medicationId);
    }

    if (options?.startDate) {
      logs = logs.filter(l => l.scheduledTime >= options.startDate!);
    }

    if (options?.endDate) {
      logs = logs.filter(l => l.scheduledTime <= options.endDate!);
    }

    logs.sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());

    if (options?.limit) {
      logs = logs.slice(0, options.limit);
    }

    return logs;
  }

  getTodaysMedications(patientId: string, caregiverId: string): {
    upcoming: CaregiverMedicationSchedule[];
    pending: CaregiverMedicationSchedule[];
    completed: CaregiverMedicationLog[];
  } {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    const activeSchedules = this.getPatientSchedules(patientId, caregiverId)
      .filter(s => s.isActive);

    const todaysLogs = this.getMedicationLogs(patientId, caregiverId, {
      startDate: `${today}T00:00:00`,
      endDate: `${today}T23:59:59`,
    });

    const loggedMedIds = new Set(todaysLogs.map(l => l.medicationId));

    const upcoming: CaregiverMedicationSchedule[] = [];
    const pending: CaregiverMedicationSchedule[] = [];

    for (const schedule of activeSchedules) {
      if (loggedMedIds.has(schedule.medicationId)) continue;

      const nextTime = schedule.scheduledTimes.find(t => t > currentTime);
      if (nextTime) {
        upcoming.push(schedule);
      } else if (schedule.scheduledTimes.some(t => t <= currentTime)) {
        pending.push(schedule);
      }
    }

    logPhiAccess({
      action: "read",
      resourceType: "CaregiverMedicationSchedule",
      patientId,
      userId: caregiverId,
      details: "Retrieved today's medications",
    });

    return {
      upcoming,
      pending,
      completed: todaysLogs.filter(l => l.status === "administered" || l.status === "late"),
    };
  }

  createRefillRequest(
    patientId: string,
    caregiverId: string,
    caregiverName: string,
    data: Omit<RefillRequestData, "id" | "patientId" | "caregiverId" | "caregiverName" | "requestedAt" | "updatedAt" | "status">
  ): RefillRequestData {
    const id = `refill-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    const request: RefillRequestData = {
      id,
      patientId,
      caregiverId,
      caregiverName,
      ...data,
      status: "pending",
      requestedAt: now,
      updatedAt: now,
    };

    refillRequests.set(id, request);

    logPhiAccess({
      action: "write",
      resourceType: "RefillRequest",
      patientId,
      userId: caregiverId,
      resourceId: id,
      details: `Created refill request for ${data.medicationName}`,
    });

    console.log(`[CaregiverMedication] Refill request created: ${id}`);

    return request;
  }

  getRefillRequests(patientId: string, caregiverId: string): RefillRequestData[] {
    logPhiAccess({
      action: "read",
      resourceType: "RefillRequest",
      patientId,
      userId: caregiverId,
      details: "Retrieved refill requests",
    });

    return Array.from(refillRequests.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  }

  updateRefillStatus(
    requestId: string,
    caregiverId: string,
    status: RefillRequestData["status"],
    notes?: string
  ): RefillRequestData | null {
    const request = refillRequests.get(requestId);
    if (!request) return null;

    request.status = status;
    request.updatedAt = new Date().toISOString();
    if (notes) request.notes = notes;

    refillRequests.set(requestId, request);

    logPhiAccess({
      action: "write",
      resourceType: "RefillRequest",
      patientId: request.patientId,
      userId: caregiverId,
      resourceId: requestId,
      details: `Updated refill status to ${status}`,
    });

    return request;
  }

  async checkInteractions(patientId: string, caregiverId: string): Promise<DrugInteractionAnalysis> {
    logPhiAccess({
      action: "read",
      resourceType: "DrugInteractionAnalysis",
      patientId,
      userId: caregiverId,
      details: "Requested drug interaction analysis",
    });

    const analysis = await analyzeMedicationInteractions(patientId, {
      userId: caregiverId,
    });

    for (const interaction of analysis.interactions) {
      if (interaction.severity === "major" || interaction.severity === "contraindicated") {
        const warningId = `warn-${randomUUID().slice(0, 8)}`;
        const warning: MedicationInteractionWarning = {
          id: warningId,
          patientId,
          severity: interaction.severity,
          medication1: interaction.medication1.name,
          medication2: interaction.medication2.name,
          description: interaction.mechanism,
          recommendation: interaction.recommendation,
          detectedAt: new Date().toISOString(),
          acknowledged: false,
        };
        interactionWarnings.set(warningId, warning);
      }
    }

    console.log(`[CaregiverMedication] Interaction check completed: ${analysis.interactions.length} found`);

    return analysis;
  }

  async checkNewMedicationInteraction(
    patientId: string,
    caregiverId: string,
    medicationName: string,
    dosage: string
  ): Promise<{ hasInteractions: boolean; riskLevel: string; interactions: any[] }> {
    logPhiAccess({
      action: "read",
      resourceType: "DrugInteractionCheck",
      patientId,
      userId: caregiverId,
      details: `Checking interactions for proposed ${medicationName}`,
    });

    const result = await checkDrugInteractions(patientId, medicationName, dosage);

    return {
      hasInteractions: result.interactions.length > 0,
      riskLevel: result.overallRiskLevel,
      interactions: result.interactions,
    };
  }

  getActiveWarnings(patientId: string, caregiverId: string): MedicationInteractionWarning[] {
    logPhiAccess({
      action: "read",
      resourceType: "MedicationInteractionWarning",
      patientId,
      userId: caregiverId,
      details: "Retrieved active interaction warnings",
    });

    return Array.from(interactionWarnings.values())
      .filter(w => w.patientId === patientId && !w.acknowledged)
      .sort((a, b) => {
        const severityOrder = { contraindicated: 0, major: 1, moderate: 2, minor: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  acknowledgeWarning(warningId: string, caregiverId: string): MedicationInteractionWarning | null {
    const warning = interactionWarnings.get(warningId);
    if (!warning) return null;

    warning.acknowledged = true;
    warning.acknowledgedBy = caregiverId;
    warning.acknowledgedAt = new Date().toISOString();

    interactionWarnings.set(warningId, warning);

    logPhiAccess({
      action: "write",
      resourceType: "MedicationInteractionWarning",
      patientId: warning.patientId,
      userId: caregiverId,
      resourceId: warningId,
      details: "Acknowledged interaction warning",
    });

    return warning;
  }

  getAdherenceStats(patientId: string, caregiverId: string, days: number = 30): {
    overallRate: number;
    medications: Array<{
      medicationId: string;
      medicationName: string;
      adherenceRate: number;
      takenCount: number;
      missedCount: number;
    }>;
  } {
    logPhiAccess({
      action: "read",
      resourceType: "CaregiverMedicationStats",
      patientId,
      userId: caregiverId,
      details: `Retrieved ${days}-day adherence stats`,
    });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = this.getMedicationLogs(patientId, caregiverId, {
      startDate: startDate.toISOString(),
    });

    const stats = new Map<string, { name: string; taken: number; missed: number }>();

    for (const log of logs) {
      let stat = stats.get(log.medicationId);
      if (!stat) {
        stat = { name: log.medicationName, taken: 0, missed: 0 };
        stats.set(log.medicationId, stat);
      }

      if (log.status === "administered" || log.status === "late") {
        stat.taken++;
      } else {
        stat.missed++;
      }
    }

    const medications = Array.from(stats.entries()).map(([id, stat]) => ({
      medicationId: id,
      medicationName: stat.name,
      adherenceRate: stat.taken + stat.missed > 0 
        ? Math.round((stat.taken / (stat.taken + stat.missed)) * 100) 
        : 100,
      takenCount: stat.taken,
      missedCount: stat.missed,
    }));

    const totalTaken = medications.reduce((sum, m) => sum + m.takenCount, 0);
    const totalMissed = medications.reduce((sum, m) => sum + m.missedCount, 0);
    const overallRate = totalTaken + totalMissed > 0 
      ? Math.round((totalTaken / (totalTaken + totalMissed)) * 100) 
      : 100;

    return { overallRate, medications };
  }

  initializeSampleData(patientId: string, caregiverId: string): void {
    const sampleMedications = [
      { id: "med-sample-1", name: "Lisinopril", dosage: "10mg", times: ["08:00"], freq: "once_daily" as const },
      { id: "med-sample-2", name: "Metformin", dosage: "500mg", times: ["08:00", "20:00"], freq: "twice_daily" as const },
      { id: "med-sample-3", name: "Atorvastatin", dosage: "20mg", times: ["21:00"], freq: "once_daily" as const },
      { id: "med-sample-4", name: "Aspirin", dosage: "81mg", times: ["08:00"], freq: "once_daily" as const },
    ];

    for (const med of sampleMedications) {
      this.createSchedule(patientId, caregiverId, "Sample Caregiver", {
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage,
        frequency: med.freq,
        scheduledTimes: med.times,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        notificationSettings: {
          enablePush: true,
          enableSms: false,
          enableEmail: false,
          advanceMinutes: 15,
          caregiverAlert: true,
          missedDoseAlert: true,
        },
      });
    }

    const now = new Date();
    for (let d = 0; d < 14; d++) {
      const logDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      
      for (const med of sampleMedications) {
        for (const time of med.times) {
          const scheduledTime = new Date(logDate);
          const [hours, minutes] = time.split(":").map(Number);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          if (scheduledTime > now) continue;
          
          const random = Math.random();
          const status = random < 0.80 ? "administered" : random < 0.90 ? "late" : random < 0.95 ? "refused" : "skipped";
          
          const schedule = Array.from(schedules.values()).find(s => s.medicationId === med.id);
          if (schedule) {
            this.logMedicationIntake(patientId, caregiverId, "Sample Caregiver", {
              scheduleId: schedule.id,
              medicationId: med.id,
              medicationName: med.name,
              dosage: med.dosage,
              scheduledTime: scheduledTime.toISOString(),
              actualTime: new Date(scheduledTime.getTime() + Math.random() * 30 * 60 * 1000).toISOString(),
              status: status as any,
              patientCondition: "normal",
            });
          }
        }
      }
    }

    console.log(`[CaregiverMedication] Sample data initialized for patient ${hashIdentifier(patientId)}`);
  }
}

export const caregiverMedicationService = new CaregiverMedicationService();
console.log("[CaregiverMedication] Service initialized with schedule, logging, refill, and interaction checking features");
