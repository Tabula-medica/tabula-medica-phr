import {
  RemoteVitalSubmission,
  HealthStatusUpdate,
  InsertRemoteVitalSubmission,
  InsertHealthStatusUpdate,
  PatientMonitoringDashboard,
  VitalTrendSummary,
  ClinicianReviewQueue,
  remoteVitalTypes,
  RemoteVitalType
} from "@shared/schema";

interface VitalRange {
  min: number;
  max: number;
  unit: string;
  label: string;
}

const VITAL_NORMAL_RANGES: Record<RemoteVitalType, VitalRange> = {
  blood_pressure_systolic: { min: 90, max: 120, unit: "mmHg", label: "Systolic Blood Pressure" },
  blood_pressure_diastolic: { min: 60, max: 80, unit: "mmHg", label: "Diastolic Blood Pressure" },
  heart_rate: { min: 60, max: 100, unit: "bpm", label: "Heart Rate" },
  temperature: { min: 97.0, max: 99.0, unit: "°F", label: "Temperature" },
  weight: { min: 0, max: 1000, unit: "lbs", label: "Weight" },
  oxygen_saturation: { min: 95, max: 100, unit: "%", label: "Oxygen Saturation" },
  respiratory_rate: { min: 12, max: 20, unit: "/min", label: "Respiratory Rate" },
  blood_glucose: { min: 70, max: 140, unit: "mg/dL", label: "Blood Glucose" },
  pain_level: { min: 0, max: 3, unit: "/10", label: "Pain Level" },
  peak_flow: { min: 400, max: 700, unit: "L/min", label: "Peak Flow" }
};

export class RemotePatientMonitoringService {
  private vitalSubmissions: Map<string, RemoteVitalSubmission> = new Map();
  private statusUpdates: Map<string, HealthStatusUpdate> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const now = new Date();
    
    const mockVitals: RemoteVitalSubmission[] = [
      {
        id: "vital-001",
        patientId: "patient-001",
        vitalType: "blood_pressure_systolic",
        value: 128,
        unit: "mmHg",
        secondaryValue: 82,
        recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        source: "manual_entry",
        notes: "Taken after morning medication",
        isAbnormal: true,
        abnormalReason: "Systolic pressure slightly elevated (128 > 120)",
        reviewedByProvider: false,
        flaggedForAttention: false
      },
      {
        id: "vital-002",
        patientId: "patient-001",
        vitalType: "heart_rate",
        value: 72,
        unit: "bpm",
        recordedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        source: "wearable_sync",
        deviceName: "Apple Watch",
        isAbnormal: false,
        reviewedByProvider: false,
        flaggedForAttention: false
      },
      {
        id: "vital-003",
        patientId: "patient-001",
        vitalType: "weight",
        value: 185.4,
        unit: "lbs",
        recordedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        source: "bluetooth_device",
        deviceName: "Withings Scale",
        isAbnormal: false,
        reviewedByProvider: true,
        reviewedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(),
        reviewedBy: "Dr. Johnson",
        flaggedForAttention: false
      },
      {
        id: "vital-004",
        patientId: "patient-001",
        vitalType: "oxygen_saturation",
        value: 98,
        unit: "%",
        recordedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        source: "home_device",
        deviceName: "Pulse Oximeter",
        isAbnormal: false,
        reviewedByProvider: false,
        flaggedForAttention: false
      },
      {
        id: "vital-005",
        patientId: "patient-001",
        vitalType: "blood_glucose",
        value: 145,
        unit: "mg/dL",
        recordedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        submittedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        source: "manual_entry",
        notes: "2 hours after breakfast",
        isAbnormal: true,
        abnormalReason: "Blood glucose elevated (145 > 140)",
        reviewedByProvider: false,
        flaggedForAttention: true
      }
    ];

    const mockStatusUpdates: HealthStatusUpdate[] = [
      {
        id: "status-001",
        patientId: "patient-001",
        type: "wellness_check",
        title: "Daily Wellness Check",
        description: "Feeling good overall. Slept well last night and have good energy.",
        overallFeeling: 8,
        mood: "good",
        sleepQuality: "good",
        sleepHours: 7.5,
        activityLevel: "moderate",
        medicationsTaken: [
          { medicationName: "Lisinopril 10mg", taken: true, takenAt: "08:00 AM" },
          { medicationName: "Metformin 500mg", taken: true, takenAt: "08:00 AM" }
        ],
        submittedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        reviewedByProvider: false,
        flaggedForAttention: false,
        followUpRequired: false
      },
      {
        id: "status-002",
        patientId: "patient-001",
        type: "symptom_report",
        title: "Mild Headache Report",
        description: "Experiencing a mild headache since this morning. Not severe but persistent.",
        overallFeeling: 6,
        symptoms: [
          { symptom: "Headache", severity: "mild", duration: "4 hours", location: "Front of head" }
        ],
        mood: "neutral",
        notes: "May be related to less sleep last night",
        submittedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
        reviewedByProvider: true,
        reviewedAt: new Date(now.getTime() - 46 * 60 * 60 * 1000).toISOString(),
        reviewedBy: "Dr. Johnson",
        providerNotes: "Monitor and report if persists. Stay hydrated.",
        flaggedForAttention: false,
        followUpRequired: false
      },
      {
        id: "status-003",
        patientId: "patient-001",
        type: "medication_adherence",
        title: "Weekly Medication Check",
        description: "Reporting weekly medication adherence",
        overallFeeling: 7,
        medicationsTaken: [
          { medicationName: "Lisinopril 10mg", taken: true, dosage: "Once daily" },
          { medicationName: "Metformin 500mg", taken: true, dosage: "Twice daily" },
          { medicationName: "Vitamin D", taken: false, missedReason: "Ran out, need refill" }
        ],
        submittedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString(),
        reviewedByProvider: false,
        flaggedForAttention: true,
        followUpRequired: true,
        followUpScheduledFor: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString()
      }
    ];

    mockVitals.forEach(v => this.vitalSubmissions.set(v.id, v));
    mockStatusUpdates.forEach(s => this.statusUpdates.set(s.id, s));
  }

  private checkVitalAbnormality(vitalType: RemoteVitalType, value: number): { isAbnormal: boolean; reason?: string } {
    const range = VITAL_NORMAL_RANGES[vitalType];
    if (!range) return { isAbnormal: false };

    if (value < range.min) {
      return { isAbnormal: true, reason: `${range.label} low (${value} < ${range.min} ${range.unit})` };
    }
    if (value > range.max) {
      return { isAbnormal: true, reason: `${range.label} elevated (${value} > ${range.max} ${range.unit})` };
    }
    return { isAbnormal: false };
  }

  submitVitals(data: InsertRemoteVitalSubmission): RemoteVitalSubmission {
    const id = `vital-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const abnormality = this.checkVitalAbnormality(data.vitalType, data.value);
    
    const submission: RemoteVitalSubmission = {
      id,
      ...data,
      submittedAt: new Date().toISOString(),
      isAbnormal: abnormality.isAbnormal,
      abnormalReason: abnormality.reason,
      reviewedByProvider: false,
      flaggedForAttention: abnormality.isAbnormal
    };

    this.vitalSubmissions.set(id, submission);
    console.log(`[HIPAA-AUDIT] Remote vital submitted: ${id}, type: ${data.vitalType}, patient: ${data.patientId}, abnormal: ${abnormality.isAbnormal}`);

    return submission;
  }

  submitHealthStatus(data: InsertHealthStatusUpdate): HealthStatusUpdate {
    const id = `status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const hasSerious = data.symptoms?.some(s => s.severity === "severe" || s.severity === "very_severe") || false;
    const hasMissedMeds = data.medicationsTaken?.some(m => !m.taken) || false;
    const hasSideEffects = (data.sideEffects?.length || 0) > 0;
    
    const update: HealthStatusUpdate = {
      id,
      ...data,
      submittedAt: new Date().toISOString(),
      reviewedByProvider: false,
      flaggedForAttention: hasSerious || data.overallFeeling <= 3,
      followUpRequired: hasSerious || hasSideEffects || hasMissedMeds
    };

    this.statusUpdates.set(id, update);
    console.log(`[HIPAA-AUDIT] Health status update submitted: ${id}, type: ${data.type}, patient: ${data.patientId}, flagged: ${update.flaggedForAttention}`);

    return update;
  }

  getPatientVitals(patientId: string, options?: {
    vitalType?: RemoteVitalType;
    startDate?: string;
    endDate?: string;
    unreviewed?: boolean;
    limit?: number;
  }): RemoteVitalSubmission[] {
    let vitals = Array.from(this.vitalSubmissions.values())
      .filter(v => v.patientId === patientId);

    if (options?.vitalType) {
      vitals = vitals.filter(v => v.vitalType === options.vitalType);
    }

    if (options?.startDate) {
      const start = new Date(options.startDate);
      vitals = vitals.filter(v => new Date(v.recordedAt) >= start);
    }

    if (options?.endDate) {
      const end = new Date(options.endDate);
      vitals = vitals.filter(v => new Date(v.recordedAt) <= end);
    }

    if (options?.unreviewed) {
      vitals = vitals.filter(v => !v.reviewedByProvider);
    }

    vitals = vitals.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

    if (options?.limit) {
      vitals = vitals.slice(0, options.limit);
    }

    return vitals;
  }

  getPatientStatusUpdates(patientId: string, options?: {
    type?: string;
    unreviewed?: boolean;
    flagged?: boolean;
    limit?: number;
  }): HealthStatusUpdate[] {
    let updates = Array.from(this.statusUpdates.values())
      .filter(s => s.patientId === patientId);

    if (options?.type) {
      updates = updates.filter(s => s.type === options.type);
    }

    if (options?.unreviewed) {
      updates = updates.filter(s => !s.reviewedByProvider);
    }

    if (options?.flagged) {
      updates = updates.filter(s => s.flaggedForAttention);
    }

    updates = updates.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    if (options?.limit) {
      updates = updates.slice(0, options.limit);
    }

    return updates;
  }

  reviewVitalSubmission(vitalId: string, reviewedBy: string, notes?: string): RemoteVitalSubmission | null {
    const vital = this.vitalSubmissions.get(vitalId);
    if (!vital) return null;

    vital.reviewedByProvider = true;
    vital.reviewedAt = new Date().toISOString();
    vital.reviewedBy = reviewedBy;
    if (notes) vital.providerNotes = notes;
    vital.flaggedForAttention = false;

    this.vitalSubmissions.set(vitalId, vital);
    console.log(`[HIPAA-AUDIT] Vital reviewed: ${vitalId} by ${reviewedBy}`);

    return vital;
  }

  reviewHealthStatus(statusId: string, reviewedBy: string, notes?: string, followUpDate?: string): HealthStatusUpdate | null {
    const status = this.statusUpdates.get(statusId);
    if (!status) return null;

    status.reviewedByProvider = true;
    status.reviewedAt = new Date().toISOString();
    status.reviewedBy = reviewedBy;
    if (notes) status.providerNotes = notes;
    if (followUpDate) {
      status.followUpRequired = true;
      status.followUpScheduledFor = followUpDate;
    }
    status.flaggedForAttention = false;

    this.statusUpdates.set(statusId, status);
    console.log(`[HIPAA-AUDIT] Health status reviewed: ${statusId} by ${reviewedBy}`);

    return status;
  }

  calculateVitalTrends(patientId: string, days: number = 30): VitalTrendSummary[] {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const vitals = this.getPatientVitals(patientId, {
      startDate: cutoffDate.toISOString()
    });

    const byType: Record<string, number[]> = {};
    vitals.forEach(v => {
      if (!byType[v.vitalType]) byType[v.vitalType] = [];
      byType[v.vitalType].push(v.value);
    });

    return Object.entries(byType).map(([type, values]) => {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      let trend: VitalTrendSummary["trend"] = "insufficient_data";
      if (values.length >= 3) {
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        const range = VITAL_NORMAL_RANGES[type as RemoteVitalType];
        if (range) {
          const isFirstNormal = firstAvg >= range.min && firstAvg <= range.max;
          const isSecondNormal = secondAvg >= range.min && secondAvg <= range.max;
          
          if (isSecondNormal && !isFirstNormal) trend = "improving";
          else if (!isSecondNormal && isFirstNormal) trend = "worsening";
          else trend = "stable";
        } else {
          trend = "stable";
        }
      }

      return {
        vitalType: type as RemoteVitalType,
        average: Math.round(avg * 10) / 10,
        min,
        max,
        trend,
        dataPoints: values.length,
        unit: VITAL_NORMAL_RANGES[type as RemoteVitalType]?.unit || ""
      };
    });
  }

  getPatientMonitoringDashboard(patientId: string, patientName: string): PatientMonitoringDashboard {
    const recentVitals = this.getPatientVitals(patientId, { limit: 10 });
    const recentStatusUpdates = this.getPatientStatusUpdates(patientId, { limit: 5 });
    const trends = this.calculateVitalTrends(patientId);

    const unreviewedVitals = recentVitals.filter(v => !v.reviewedByProvider).length;
    const unreviewedStatus = recentStatusUpdates.filter(s => !s.reviewedByProvider).length;
    const flaggedVitals = recentVitals.filter(v => v.flaggedForAttention).length;
    const flaggedStatus = recentStatusUpdates.filter(s => s.flaggedForAttention).length;

    const allSubmissions = [
      ...recentVitals.map(v => v.submittedAt),
      ...recentStatusUpdates.map(s => s.submittedAt)
    ].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const totalExpected = 7;
    const totalSubmitted = recentVitals.length + recentStatusUpdates.length;
    const complianceScore = Math.min(100, Math.round((totalSubmitted / totalExpected) * 100));

    return {
      patientId,
      patientName,
      recentVitals,
      recentStatusUpdates,
      upcomingAppointments: [],
      flaggedItems: flaggedVitals + flaggedStatus,
      lastSubmission: allSubmissions[0],
      complianceScore,
      trends
    };
  }

  getClinicianReviewQueue(): ClinicianReviewQueue {
    const pendingVitals = Array.from(this.vitalSubmissions.values())
      .filter(v => !v.reviewedByProvider)
      .sort((a, b) => {
        if (a.flaggedForAttention && !b.flaggedForAttention) return -1;
        if (!a.flaggedForAttention && b.flaggedForAttention) return 1;
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });

    const pendingStatusUpdates = Array.from(this.statusUpdates.values())
      .filter(s => !s.reviewedByProvider)
      .sort((a, b) => {
        if (a.flaggedForAttention && !b.flaggedForAttention) return -1;
        if (!a.flaggedForAttention && b.flaggedForAttention) return 1;
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });

    const patientIds = new Set([
      ...pendingVitals.filter(v => v.flaggedForAttention).map(v => v.patientId),
      ...pendingStatusUpdates.filter(s => s.flaggedForAttention).map(s => s.patientId)
    ]);

    const flaggedPatients = Array.from(patientIds).map(pid => 
      this.getPatientMonitoringDashboard(pid, `Patient ${pid}`)
    );

    return {
      pendingVitals,
      pendingStatusUpdates,
      flaggedPatients,
      totalPendingReviews: pendingVitals.length + pendingStatusUpdates.length
    };
  }

  getVitalTypes(): typeof remoteVitalTypes {
    return remoteVitalTypes;
  }

  getVitalRanges(): typeof VITAL_NORMAL_RANGES {
    return VITAL_NORMAL_RANGES;
  }
}

export const remotePatientMonitoringService = new RemotePatientMonitoringService();
