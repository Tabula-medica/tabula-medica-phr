import { logPhiAccess } from "../security/hipaa-audit";

export interface MedicationReminder {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: "once_daily" | "twice_daily" | "three_times_daily" | "four_times_daily" | "weekly" | "as_needed" | "custom";
  scheduledTimes: string[];
  daysOfWeek?: number[];
  startDate: string;
  endDate?: string;
  isActive: boolean;
  notificationPreferences: {
    push: boolean;
    email: boolean;
    sms: boolean;
    advanceMinutes: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdherenceLog {
  id: string;
  patientId: string;
  medicationId: string;
  reminderId: string;
  scheduledTime: string;
  actualTime?: string;
  status: "taken" | "skipped" | "late" | "pending" | "missed";
  notes?: string;
  sideEffects?: string[];
  mood?: "good" | "neutral" | "poor";
  createdAt: string;
}

export interface AdherenceStats {
  medicationId: string;
  medicationName: string;
  totalDoses: number;
  takenOnTime: number;
  takenLate: number;
  skipped: number;
  missed: number;
  adherenceRate: number;
  streakDays: number;
  longestStreak: number;
  lastTaken?: string;
}

export interface NonAdherenceFlag {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  flagType: "missed_doses" | "low_adherence" | "pattern_detected" | "critical_medication";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  missedCount?: number;
  adherenceRate?: number;
  detectedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  status: "pending" | "reviewed" | "resolved" | "escalated";
}

const reminders = new Map<string, MedicationReminder>();
const adherenceLogs = new Map<string, AdherenceLog>();
const nonAdherenceFlags = new Map<string, NonAdherenceFlag>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export class MedicationAdherenceService {
  async createReminder(patientId: string, data: Omit<MedicationReminder, "id" | "patientId" | "createdAt" | "updatedAt">): Promise<MedicationReminder> {
    const id = `rem-${generateId()}`;
    const now = new Date().toISOString();
    
    const reminder: MedicationReminder = {
      ...data,
      id,
      patientId,
      createdAt: now,
      updatedAt: now,
    };

    reminders.set(id, reminder);

    await logPhiAccess({
      action: "write",
      resourceType: "MedicationReminder",
      patientId,
      userId: patientId,
      resourceId: id,
      details: `Created medication reminder for ${data.medicationName}`,
    });

    return reminder;
  }

  async getReminders(patientId: string): Promise<MedicationReminder[]> {
    return Array.from(reminders.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateReminder(reminderId: string, updates: Partial<MedicationReminder>): Promise<MedicationReminder | null> {
    const reminder = reminders.get(reminderId);
    if (!reminder) return null;

    const updated: MedicationReminder = {
      ...reminder,
      ...updates,
      id: reminder.id,
      patientId: reminder.patientId,
      updatedAt: new Date().toISOString(),
    };

    reminders.set(reminderId, updated);
    return updated;
  }

  async deleteReminder(reminderId: string): Promise<boolean> {
    return reminders.delete(reminderId);
  }

  async logAdherence(patientId: string, data: Omit<AdherenceLog, "id" | "patientId" | "createdAt">): Promise<AdherenceLog> {
    const id = `log-${generateId()}`;
    const now = new Date().toISOString();

    const log: AdherenceLog = {
      ...data,
      id,
      patientId,
      createdAt: now,
    };

    adherenceLogs.set(id, log);

    await logPhiAccess({
      action: "write",
      resourceType: "AdherenceLog",
      patientId,
      userId: patientId,
      resourceId: id,
      details: `Logged adherence: ${data.status} for medication ${data.medicationId}`,
    });

    if (data.status === "skipped" || data.status === "missed") {
      await this.checkAndFlagNonAdherence(patientId, data.medicationId);
    }

    return log;
  }

  async getAdherenceLogs(patientId: string, options?: { 
    medicationId?: string; 
    startDate?: string; 
    endDate?: string;
    limit?: number;
  }): Promise<AdherenceLog[]> {
    let logs = Array.from(adherenceLogs.values())
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

  async getAdherenceStats(patientId: string, medicationId?: string, days: number = 30): Promise<AdherenceStats[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const logs = await this.getAdherenceLogs(patientId, {
      medicationId,
      startDate: startDate.toISOString(),
    });

    const medicationStats = new Map<string, AdherenceStats>();

    for (const log of logs) {
      let stats = medicationStats.get(log.medicationId);
      
      if (!stats) {
        const reminder = Array.from(reminders.values()).find(r => r.medicationId === log.medicationId);
        stats = {
          medicationId: log.medicationId,
          medicationName: reminder?.medicationName || log.medicationId,
          totalDoses: 0,
          takenOnTime: 0,
          takenLate: 0,
          skipped: 0,
          missed: 0,
          adherenceRate: 0,
          streakDays: 0,
          longestStreak: 0,
        };
        medicationStats.set(log.medicationId, stats);
      }

      stats.totalDoses++;
      
      switch (log.status) {
        case "taken":
          stats.takenOnTime++;
          if (!stats.lastTaken || log.actualTime! > stats.lastTaken) {
            stats.lastTaken = log.actualTime;
          }
          break;
        case "late":
          stats.takenLate++;
          if (!stats.lastTaken || log.actualTime! > stats.lastTaken) {
            stats.lastTaken = log.actualTime;
          }
          break;
        case "skipped":
          stats.skipped++;
          break;
        case "missed":
          stats.missed++;
          break;
      }
    }

    for (const stats of Array.from(medicationStats.values())) {
      if (stats.totalDoses > 0) {
        stats.adherenceRate = Math.round(((stats.takenOnTime + stats.takenLate) / stats.totalDoses) * 100);
      }
      
      const medLogs = logs.filter(l => l.medicationId === stats.medicationId)
        .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
      
      let currentStreak = 0;
      let maxStreak = 0;
      
      for (const log of medLogs) {
        if (log.status === "taken" || log.status === "late") {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      
      stats.streakDays = currentStreak;
      stats.longestStreak = maxStreak;
    }

    return Array.from(medicationStats.values());
  }

  async getDailyAdherenceData(patientId: string, days: number = 30): Promise<{ date: string; taken: number; missed: number; rate: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const logs = await this.getAdherenceLogs(patientId, { startDate: startDate.toISOString() });
    
    const dailyData = new Map<string, { taken: number; missed: number; total: number }>();
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyData.set(dateStr, { taken: 0, missed: 0, total: 0 });
    }
    
    for (const log of logs) {
      const dateStr = log.scheduledTime.split("T")[0];
      const data = dailyData.get(dateStr);
      if (data) {
        data.total++;
        if (log.status === "taken" || log.status === "late") {
          data.taken++;
        } else if (log.status === "skipped" || log.status === "missed") {
          data.missed++;
        }
      }
    }
    
    return Array.from(dailyData.entries())
      .map(([date, data]) => ({
        date,
        taken: data.taken,
        missed: data.missed,
        rate: data.total > 0 ? Math.round((data.taken / data.total) * 100) : 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async checkAndFlagNonAdherence(patientId: string, medicationId: string): Promise<void> {
    const stats = await this.getAdherenceStats(patientId, medicationId, 7);
    const medStats = stats.find(s => s.medicationId === medicationId);
    
    if (!medStats) return;

    const existingFlags = Array.from(nonAdherenceFlags.values())
      .filter(f => f.patientId === patientId && f.medicationId === medicationId && f.status === "pending");
    
    if (existingFlags.length > 0) return;

    if (medStats.adherenceRate < 50 && medStats.totalDoses >= 3) {
      await this.createFlag(patientId, medicationId, medStats.medicationName, {
        flagType: "low_adherence",
        severity: medStats.adherenceRate < 25 ? "critical" : "high",
        description: `Adherence rate is ${medStats.adherenceRate}% over the past 7 days`,
        adherenceRate: medStats.adherenceRate,
      });
    } else if (medStats.missed >= 3) {
      await this.createFlag(patientId, medicationId, medStats.medicationName, {
        flagType: "missed_doses",
        severity: medStats.missed >= 5 ? "high" : "medium",
        description: `${medStats.missed} doses missed in the past 7 days`,
        missedCount: medStats.missed,
      });
    }
  }

  async createFlag(
    patientId: string, 
    medicationId: string, 
    medicationName: string,
    data: Partial<NonAdherenceFlag>
  ): Promise<NonAdherenceFlag> {
    const id = `flag-${generateId()}`;
    
    const flag: NonAdherenceFlag = {
      id,
      patientId,
      medicationId,
      medicationName,
      flagType: data.flagType || "missed_doses",
      severity: data.severity || "medium",
      description: data.description || "Potential non-adherence detected",
      missedCount: data.missedCount,
      adherenceRate: data.adherenceRate,
      detectedAt: new Date().toISOString(),
      status: "pending",
    };

    nonAdherenceFlags.set(id, flag);

    await logPhiAccess({
      action: "write",
      resourceType: "NonAdherenceFlag",
      patientId,
      userId: "system",
      resourceId: id,
      details: `Created non-adherence flag: ${flag.flagType} for ${medicationName}`,
    });

    return flag;
  }

  async getFlags(patientId: string, status?: string): Promise<NonAdherenceFlag[]> {
    let flags = Array.from(nonAdherenceFlags.values())
      .filter(f => f.patientId === patientId);
    
    if (status) {
      flags = flags.filter(f => f.status === status);
    }
    
    return flags.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
  }

  async updateFlagStatus(flagId: string, status: NonAdherenceFlag["status"], reviewedBy?: string): Promise<NonAdherenceFlag | null> {
    const flag = nonAdherenceFlags.get(flagId);
    if (!flag) return null;

    flag.status = status;
    if (status === "reviewed" || status === "resolved") {
      flag.reviewedAt = new Date().toISOString();
      flag.reviewedBy = reviewedBy;
    }

    nonAdherenceFlags.set(flagId, flag);
    return flag;
  }

  async getOverallAdherenceRate(patientId: string, days: number = 30): Promise<number> {
    const stats = await this.getAdherenceStats(patientId, undefined, days);
    
    if (stats.length === 0) return 100;
    
    const totalDoses = stats.reduce((sum, s) => sum + s.totalDoses, 0);
    const takenDoses = stats.reduce((sum, s) => sum + s.takenOnTime + s.takenLate, 0);
    
    return totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 100;
  }

  async getTodaysMedications(patientId: string): Promise<{
    upcoming: MedicationReminder[];
    taken: AdherenceLog[];
    pending: MedicationReminder[];
  }> {
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);
    
    const patientReminders = await this.getReminders(patientId);
    const activeReminders = patientReminders.filter(r => r.isActive);
    
    const todaysLogs = await this.getAdherenceLogs(patientId, {
      startDate: `${today}T00:00:00`,
      endDate: `${today}T23:59:59`,
    });
    
    const takenMedIds = new Set(todaysLogs.filter(l => l.status === "taken" || l.status === "late").map(l => l.medicationId));
    
    const upcoming: MedicationReminder[] = [];
    const pending: MedicationReminder[] = [];
    
    for (const reminder of activeReminders) {
      if (takenMedIds.has(reminder.medicationId)) continue;
      
      const nextTime = reminder.scheduledTimes.find(t => t > currentTime);
      if (nextTime) {
        upcoming.push(reminder);
      } else if (reminder.scheduledTimes.some(t => t <= currentTime)) {
        pending.push(reminder);
      }
    }
    
    return {
      upcoming,
      taken: todaysLogs.filter(l => l.status === "taken" || l.status === "late"),
      pending,
    };
  }

  initializeSampleData(patientId: string): void {
    const medications = [
      { id: "med-1", name: "Lisinopril", dosage: "10mg", times: ["08:00"] },
      { id: "med-2", name: "Metformin", dosage: "500mg", times: ["08:00", "20:00"] },
      { id: "med-3", name: "Atorvastatin", dosage: "20mg", times: ["21:00"] },
      { id: "med-4", name: "Aspirin", dosage: "81mg", times: ["08:00"] },
    ];

    const now = new Date();

    for (const med of medications) {
      const reminderId = `rem-${med.id}`;
      reminders.set(reminderId, {
        id: reminderId,
        patientId,
        medicationId: med.id,
        medicationName: med.name,
        dosage: med.dosage,
        frequency: med.times.length === 1 ? "once_daily" : "twice_daily",
        scheduledTimes: med.times,
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        notificationPreferences: {
          push: true,
          email: false,
          sms: false,
          advanceMinutes: 15,
        },
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: now.toISOString(),
      });

      for (let d = 0; d < 30; d++) {
        const logDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
        
        for (const time of med.times) {
          const scheduledTime = new Date(logDate);
          const [hours, minutes] = time.split(":").map(Number);
          scheduledTime.setHours(hours, minutes, 0, 0);
          
          const random = Math.random();
          let status: AdherenceLog["status"];
          let actualTime: string | undefined;
          
          if (random < 0.75) {
            status = "taken";
            actualTime = new Date(scheduledTime.getTime() + Math.random() * 10 * 60 * 1000).toISOString();
          } else if (random < 0.85) {
            status = "late";
            actualTime = new Date(scheduledTime.getTime() + (30 + Math.random() * 60) * 60 * 1000).toISOString();
          } else if (random < 0.92) {
            status = "skipped";
          } else {
            status = "missed";
          }
          
          const logId = `log-${med.id}-${d}-${time}`;
          adherenceLogs.set(logId, {
            id: logId,
            patientId,
            medicationId: med.id,
            reminderId,
            scheduledTime: scheduledTime.toISOString(),
            actualTime,
            status,
            createdAt: scheduledTime.toISOString(),
          });
        }
      }
    }
  }
}

export const medicationAdherenceService = new MedicationAdherenceService();
