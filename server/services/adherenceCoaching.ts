import { generatePhiSafeText } from "./ai-gateway";
import { storage } from "../storage";
import type { Patient, Medication, Appointment } from "@shared/schema";

export interface AdherenceRecord {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  scheduledTime: string;
  takenAt?: string;
  skipped: boolean;
  skipReason?: string;
  notes?: string;
}

export interface AdherenceStats {
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  totalDoses: number;
  takenDoses: number;
  missedDoses: number;
  adherenceRate: number;
  streak: number;
  lastTaken?: string;
  commonSkipReasons: string[];
}

export interface CoachingMessage {
  id: string;
  type: "reminder" | "encouragement" | "tip" | "warning" | "celebration";
  priority: "high" | "medium" | "low";
  title: string;
  message: string;
  actionable: boolean;
  suggestedAction?: string;
  relatedMedicationId?: string;
  expiresAt?: string;
}

export interface AdherenceCoachingPlan {
  patientId: string;
  overallAdherenceRate: number;
  riskLevel: "low" | "medium" | "high";
  medications: AdherenceStats[];
  coachingMessages: CoachingMessage[];
  personalizedTips: string[];
  nextCheckIn: string;
}

interface PatientAdherenceContext {
  patient: Patient | undefined;
  medications: Medication[];
  appointments: Appointment[];
  adherenceHistory: AdherenceRecord[];
}

async function getPatientAdherenceContext(patientId: string): Promise<PatientAdherenceContext> {
  const [patient, medications, appointments] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicationsByPatient(patientId),
    storage.getAppointments(),
  ]);

  const activeMedications = medications.filter(m => m.status === "active");
  const patientAppointments = appointments.filter(a => a.patientId === patientId);

  const adherenceHistory = generateMockAdherenceHistory(patientId, activeMedications);

  return {
    patient,
    medications: activeMedications,
    appointments: patientAppointments,
    adherenceHistory,
  };
}

function generateMockAdherenceHistory(patientId: string, medications: Medication[]): AdherenceRecord[] {
  const records: AdherenceRecord[] = [];
  const now = new Date();
  
  for (const med of medications) {
    for (let i = 0; i < 14; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const taken = Math.random() > 0.15;
      
      records.push({
        id: `adh_${med.id}_${i}`,
        patientId,
        medicationId: med.id,
        medicationName: med.name,
        scheduledTime: date.toISOString(),
        takenAt: taken ? date.toISOString() : undefined,
        skipped: !taken,
        skipReason: !taken ? ["Forgot", "Side effects", "Ran out", "Felt fine"][Math.floor(Math.random() * 4)] : undefined,
      });
    }
  }
  
  return records;
}

function calculateAdherenceStats(
  medication: Medication,
  history: AdherenceRecord[]
): AdherenceStats {
  const medHistory = history.filter(h => h.medicationId === medication.id);
  const takenDoses = medHistory.filter(h => !h.skipped).length;
  const missedDoses = medHistory.filter(h => h.skipped).length;
  const totalDoses = medHistory.length;
  
  let streak = 0;
  const sorted = [...medHistory].sort((a, b) => 
    new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime()
  );
  for (const record of sorted) {
    if (!record.skipped) streak++;
    else break;
  }
  
  const skipReasons = medHistory
    .filter(h => h.skipReason)
    .map(h => h.skipReason!);
  const reasonCounts = skipReasons.reduce((acc, reason) => {
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const commonSkipReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);

  return {
    medicationId: medication.id,
    medicationName: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    totalDoses,
    takenDoses,
    missedDoses,
    adherenceRate: totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0,
    streak,
    lastTaken: medHistory.find(h => !h.skipped)?.takenAt,
    commonSkipReasons,
  };
}

export async function generateAdherenceCoachingPlan(
  patientId: string
): Promise<AdherenceCoachingPlan> {
  const context = await getPatientAdherenceContext(patientId);
  
  const medicationStats = context.medications.map(med => 
    calculateAdherenceStats(med, context.adherenceHistory)
  );
  
  const overallAdherenceRate = medicationStats.length > 0
    ? Math.round(medicationStats.reduce((sum, s) => sum + s.adherenceRate, 0) / medicationStats.length)
    : 100;
  
  const riskLevel = overallAdherenceRate >= 80 ? "low" : overallAdherenceRate >= 60 ? "medium" : "high";

  const content = await generatePhiSafeText({
    system: `You are a medication adherence coach helping patients stay on track with their medications. Be supportive, understanding, and practical.

Return a JSON object with:
- coachingMessages: array of 3-5 messages, each with:
  - type: "reminder" | "encouragement" | "tip" | "warning" | "celebration"
  - priority: "high" | "medium" | "low"
  - title: string (short, attention-grabbing)
  - message: string (2-3 sentences, supportive and actionable)
  - actionable: boolean
  - suggestedAction: string (if actionable)
  - relatedMedicationId: string (optional, use medication ID if specific to one med)
- personalizedTips: string[] (5-7 practical tips based on their patterns)
- nextCheckInDays: number (when to check in again, 1-7 days)

Consider:
- Celebrate streaks and good adherence
- Address specific skip reasons with solutions
- Provide practical timing/routine tips
- Be encouraging, not judgmental about missed doses
- Suggest talking to doctor if side effects are a pattern`,
    user: `Create a coaching plan for a patient with:
Overall adherence: ${overallAdherenceRate}%
Risk level: ${riskLevel}

Medications:
${medicationStats.map(s =>
  `- ${s.medicationName} (${s.dosage}, ${s.frequency}): ${s.adherenceRate}% adherence, ${s.streak} day streak
   Skip reasons: ${s.commonSkipReasons.join(", ") || "none"}`
).join("\n")}

Upcoming appointments: ${context.appointments.filter(a => a.status === "scheduled").length}`,
    responseMimeType: "application/json",
    maxTokens: 2500,
  });

  const result = JSON.parse(content || "{}");
  
  const nextCheckIn = new Date();
  nextCheckIn.setDate(nextCheckIn.getDate() + (result.nextCheckInDays || 3));

  return {
    patientId,
    overallAdherenceRate,
    riskLevel,
    medications: medicationStats,
    coachingMessages: (result.coachingMessages || []).map((m: any, idx: number) => ({
      id: `coach_${Date.now()}_${idx}`,
      type: m.type || "tip",
      priority: m.priority || "medium",
      title: m.title,
      message: m.message,
      actionable: m.actionable || false,
      suggestedAction: m.suggestedAction,
      relatedMedicationId: m.relatedMedicationId,
    })),
    personalizedTips: result.personalizedTips || [],
    nextCheckIn: nextCheckIn.toISOString(),
  };
}

export async function generateMedicationReminder(
  patientId: string,
  medicationId: string
): Promise<CoachingMessage> {
  const [medication, patient] = await Promise.all([
    storage.getMedication(medicationId),
    storage.getPatient(patientId),
  ]);

  if (!medication) {
    throw new Error("Medication not found");
  }

  const content = await generatePhiSafeText({
    system: `You are a friendly medication reminder assistant. Create a brief, encouraging reminder.

Return a JSON object with:
- title: string (short, friendly)
- message: string (1-2 sentences, warm and supportive)
- tip: string (optional quick tip about this medication)`,
    user: `Create a reminder for ${patient?.firstName || "the patient"} to take their ${medication.name} (${medication.dosage}, ${medication.frequency}).`,
    responseMimeType: "application/json",
    maxTokens: 500,
  });

  const result = JSON.parse(content || "{}");

  return {
    id: `rem_${Date.now()}`,
    type: "reminder",
    priority: "high",
    title: result.title || `Time for ${medication.name}`,
    message: result.message || `Don't forget to take your ${medication.name} (${medication.dosage}).`,
    actionable: true,
    suggestedAction: "Mark as taken",
    relatedMedicationId: medicationId,
  };
}

export async function logAdherenceEvent(
  patientId: string,
  medicationId: string,
  taken: boolean,
  skipReason?: string
): Promise<AdherenceRecord> {
  const medication = await storage.getMedication(medicationId);
  
  return {
    id: `adh_${Date.now()}`,
    patientId,
    medicationId,
    medicationName: medication?.name || "Unknown",
    scheduledTime: new Date().toISOString(),
    takenAt: taken ? new Date().toISOString() : undefined,
    skipped: !taken,
    skipReason,
  };
}

export async function getAdherenceSummary(
  patientId: string
): Promise<{ weekly: number; monthly: number; trend: "improving" | "stable" | "declining" }> {
  const context = await getPatientAdherenceContext(patientId);
  
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  
  const weeklyRecords = context.adherenceHistory.filter(r => 
    new Date(r.scheduledTime) >= weekAgo
  );
  const previousWeekRecords = context.adherenceHistory.filter(r => 
    new Date(r.scheduledTime) >= twoWeeksAgo && new Date(r.scheduledTime) < weekAgo
  );
  
  const weeklyRate = weeklyRecords.length > 0
    ? Math.round((weeklyRecords.filter(r => !r.skipped).length / weeklyRecords.length) * 100)
    : 100;
  
  const previousWeekRate = previousWeekRecords.length > 0
    ? Math.round((previousWeekRecords.filter(r => !r.skipped).length / previousWeekRecords.length) * 100)
    : 100;
  
  const allTaken = context.adherenceHistory.filter(r => !r.skipped).length;
  const monthly = context.adherenceHistory.length > 0
    ? Math.round((allTaken / context.adherenceHistory.length) * 100)
    : 100;
  
  let trend: "improving" | "stable" | "declining" = "stable";
  if (weeklyRate > previousWeekRate + 5) trend = "improving";
  else if (weeklyRate < previousWeekRate - 5) trend = "declining";

  return { weekly: weeklyRate, monthly, trend };
}
