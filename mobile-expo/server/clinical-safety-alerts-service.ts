import { db } from "./db";
import { sensorAlerts, sensorReadings, healthRecords, users } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface ClinicalReferenceRange {
  name: string;
  unit: string;
  normalMin: number;
  normalMax: number;
  warningLowMin?: number;
  warningHighMax?: number;
  criticalLowMin?: number;
  criticalHighMax?: number;
  ageAdjusted?: boolean;
  genderSpecific?: { male: { min: number; max: number }; female: { min: number; max: number } };
}

interface SafetyAlert {
  id: string;
  userId: string;
  alertType: "critical" | "warning" | "info";
  severity: "critical" | "high" | "medium" | "low";
  vitalType: string;
  value: number;
  unit: string;
  referenceRange: { min: number; max: number };
  title: string;
  message: string;
  recommendation: string;
  contactProvider: boolean;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

const CLINICAL_REFERENCE_RANGES: Record<string, ClinicalReferenceRange> = {
  blood_pressure_systolic: {
    name: "Blood Pressure (Systolic)",
    unit: "mmHg",
    normalMin: 90,
    normalMax: 120,
    warningLowMin: 80,
    warningHighMax: 140,
    criticalLowMin: 70,
    criticalHighMax: 180,
  },
  blood_pressure_diastolic: {
    name: "Blood Pressure (Diastolic)",
    unit: "mmHg",
    normalMin: 60,
    normalMax: 80,
    warningLowMin: 50,
    warningHighMax: 90,
    criticalLowMin: 40,
    criticalHighMax: 120,
  },
  heart_rate: {
    name: "Heart Rate",
    unit: "bpm",
    normalMin: 60,
    normalMax: 100,
    warningLowMin: 50,
    warningHighMax: 110,
    criticalLowMin: 40,
    criticalHighMax: 150,
  },
  respiratory_rate: {
    name: "Respiratory Rate",
    unit: "breaths/min",
    normalMin: 12,
    normalMax: 20,
    warningLowMin: 10,
    warningHighMax: 24,
    criticalLowMin: 8,
    criticalHighMax: 30,
  },
  oxygen_saturation: {
    name: "Oxygen Saturation (SpO2)",
    unit: "%",
    normalMin: 95,
    normalMax: 100,
    warningLowMin: 92,
    criticalLowMin: 88,
  },
  body_temperature: {
    name: "Body Temperature",
    unit: "°F",
    normalMin: 97.0,
    normalMax: 99.0,
    warningLowMin: 96.0,
    warningHighMax: 100.4,
    criticalLowMin: 95.0,
    criticalHighMax: 103.0,
  },
  blood_glucose_fasting: {
    name: "Blood Glucose (Fasting)",
    unit: "mg/dL",
    normalMin: 70,
    normalMax: 100,
    warningLowMin: 60,
    warningHighMax: 125,
    criticalLowMin: 50,
    criticalHighMax: 200,
  },
  blood_glucose_random: {
    name: "Blood Glucose (Random)",
    unit: "mg/dL",
    normalMin: 70,
    normalMax: 140,
    warningLowMin: 60,
    warningHighMax: 180,
    criticalLowMin: 50,
    criticalHighMax: 300,
  },
  hemoglobin_a1c: {
    name: "Hemoglobin A1C",
    unit: "%",
    normalMin: 4.0,
    normalMax: 5.6,
    warningHighMax: 6.4,
    criticalHighMax: 9.0,
  },
  cholesterol_total: {
    name: "Total Cholesterol",
    unit: "mg/dL",
    normalMin: 100,
    normalMax: 200,
    warningHighMax: 239,
    criticalHighMax: 280,
  },
  cholesterol_ldl: {
    name: "LDL Cholesterol",
    unit: "mg/dL",
    normalMin: 0,
    normalMax: 100,
    warningHighMax: 159,
    criticalHighMax: 190,
  },
  cholesterol_hdl: {
    name: "HDL Cholesterol",
    unit: "mg/dL",
    normalMin: 40,
    normalMax: 60,
    warningLowMin: 35,
    criticalLowMin: 25,
  },
  triglycerides: {
    name: "Triglycerides",
    unit: "mg/dL",
    normalMin: 0,
    normalMax: 150,
    warningHighMax: 199,
    criticalHighMax: 500,
  },
  creatinine: {
    name: "Creatinine",
    unit: "mg/dL",
    normalMin: 0.7,
    normalMax: 1.3,
    warningHighMax: 2.0,
    criticalHighMax: 4.0,
    genderSpecific: {
      male: { min: 0.7, max: 1.3 },
      female: { min: 0.6, max: 1.1 },
    },
  },
  egfr: {
    name: "eGFR (Kidney Function)",
    unit: "mL/min/1.73m²",
    normalMin: 90,
    normalMax: 120,
    warningLowMin: 60,
    criticalLowMin: 30,
  },
  potassium: {
    name: "Potassium",
    unit: "mEq/L",
    normalMin: 3.5,
    normalMax: 5.0,
    warningLowMin: 3.0,
    warningHighMax: 5.5,
    criticalLowMin: 2.5,
    criticalHighMax: 6.5,
  },
  sodium: {
    name: "Sodium",
    unit: "mEq/L",
    normalMin: 136,
    normalMax: 145,
    warningLowMin: 130,
    warningHighMax: 150,
    criticalLowMin: 125,
    criticalHighMax: 155,
  },
  bmi: {
    name: "Body Mass Index",
    unit: "kg/m²",
    normalMin: 18.5,
    normalMax: 24.9,
    warningLowMin: 16.0,
    warningHighMax: 29.9,
    criticalLowMin: 14.0,
    criticalHighMax: 40.0,
  },
};

export class ClinicalSafetyAlertsService {
  private static instance: ClinicalSafetyAlertsService;

  static getInstance(): ClinicalSafetyAlertsService {
    if (!ClinicalSafetyAlertsService.instance) {
      ClinicalSafetyAlertsService.instance = new ClinicalSafetyAlertsService();
    }
    return ClinicalSafetyAlertsService.instance;
  }

  getReferenceRanges(): Record<string, ClinicalReferenceRange> {
    return CLINICAL_REFERENCE_RANGES;
  }

  getReferenceRange(vitalType: string): ClinicalReferenceRange | undefined {
    return CLINICAL_REFERENCE_RANGES[vitalType.toLowerCase().replace(/\s+/g, "_")];
  }

  evaluateValue(
    vitalType: string,
    value: number,
    gender?: "male" | "female"
  ): {
    status: "normal" | "warning_low" | "warning_high" | "critical_low" | "critical_high";
    severity: "normal" | "low" | "medium" | "high" | "critical";
    message: string;
    contactProvider: boolean;
  } {
    const range = this.getReferenceRange(vitalType);
    if (!range) {
      return {
        status: "normal",
        severity: "normal",
        message: "Reference range not available for this measurement.",
        contactProvider: false,
      };
    }

    let { normalMin, normalMax } = range;

    if (range.genderSpecific && gender) {
      const genderRange = range.genderSpecific[gender];
      normalMin = genderRange.min;
      normalMax = genderRange.max;
    }

    if (range.criticalLowMin !== undefined && value < range.criticalLowMin) {
      return {
        status: "critical_low",
        severity: "critical",
        message: `Your ${range.name} of ${value} ${range.unit} is critically low. Please contact your healthcare provider immediately.`,
        contactProvider: true,
      };
    }

    if (range.criticalHighMax !== undefined && value > range.criticalHighMax) {
      return {
        status: "critical_high",
        severity: "critical",
        message: `Your ${range.name} of ${value} ${range.unit} is critically high. Please contact your healthcare provider immediately.`,
        contactProvider: true,
      };
    }

    if (range.warningLowMin !== undefined && value < range.warningLowMin) {
      return {
        status: "warning_low",
        severity: "medium",
        message: `Your ${range.name} of ${value} ${range.unit} is below the normal range. Consider consulting with your healthcare provider.`,
        contactProvider: true,
      };
    }

    if (range.warningHighMax !== undefined && value > range.warningHighMax) {
      return {
        status: "warning_high",
        severity: "medium",
        message: `Your ${range.name} of ${value} ${range.unit} is above the normal range. Consider consulting with your healthcare provider.`,
        contactProvider: true,
      };
    }

    if (value < normalMin) {
      return {
        status: "warning_low",
        severity: "low",
        message: `Your ${range.name} of ${value} ${range.unit} is slightly below normal (${normalMin}-${normalMax} ${range.unit}).`,
        contactProvider: false,
      };
    }

    if (value > normalMax) {
      return {
        status: "warning_high",
        severity: "low",
        message: `Your ${range.name} of ${value} ${range.unit} is slightly above normal (${normalMin}-${normalMax} ${range.unit}).`,
        contactProvider: false,
      };
    }

    return {
      status: "normal",
      severity: "normal",
      message: `Your ${range.name} of ${value} ${range.unit} is within the normal range.`,
      contactProvider: false,
    };
  }

  async checkAndCreateAlert(
    userId: string,
    vitalType: string,
    value: number,
    unit: string,
    sourceRecordId?: string,
    gender?: "male" | "female"
  ): Promise<SafetyAlert | null> {
    const evaluation = this.evaluateValue(vitalType, value, gender);

    if (evaluation.severity === "normal") {
      return null;
    }

    const range = this.getReferenceRange(vitalType);
    if (!range) return null;

    const alertType = evaluation.severity === "critical" ? "critical" : "warning";
    const severity = evaluation.severity as "critical" | "high" | "medium" | "low";

    let recommendation = "";
    if (evaluation.contactProvider) {
      if (evaluation.severity === "critical") {
        recommendation = "URGENT: Please contact your healthcare provider or seek emergency care immediately. Do not delay.";
      } else {
        recommendation = "We recommend scheduling an appointment with your healthcare provider to discuss this result.";
      }
    } else {
      recommendation = "Monitor this value and consider discussing with your healthcare provider at your next visit.";
    }

    const [alert] = await db
      .insert(sensorAlerts)
      .values({
        userId,
        alertType,
        severity,
        title: `${range.name} Alert`,
        message: evaluation.message,
        dataType: vitalType,
        triggerValue: { value, unit },
        thresholdValue: { min: range.normalMin, max: range.normalMax, unit: range.unit },
        recommendations: [recommendation],
        status: "active",
        notifiedProvider: false,
      })
      .returning();

    console.log(`[ClinicalSafety] Created ${severity} alert for user ${userId}: ${range.name} = ${value} ${unit}`);

    return {
      id: alert.id,
      userId,
      alertType,
      severity,
      vitalType,
      value,
      unit,
      referenceRange: { min: range.normalMin, max: range.normalMax },
      title: `${range.name} Alert`,
      message: evaluation.message,
      recommendation,
      contactProvider: evaluation.contactProvider,
      createdAt: alert.createdAt,
    };
  }

  async getActiveAlerts(userId: string): Promise<SafetyAlert[]> {
    const alerts = await db
      .select()
      .from(sensorAlerts)
      .where(
        and(
          eq(sensorAlerts.userId, userId),
          eq(sensorAlerts.status, "active")
        )
      )
      .orderBy(desc(sensorAlerts.createdAt));

    return alerts.map((alert) => {
      const triggerValue = alert.triggerValue as { value: number; unit: string } | null;
      const thresholdValue = alert.thresholdValue as { min: number; max: number; unit: string } | null;

      return {
        id: alert.id,
        userId: alert.userId,
        alertType: alert.alertType as "critical" | "warning" | "info",
        severity: alert.severity as "critical" | "high" | "medium" | "low",
        vitalType: alert.dataType || "",
        value: triggerValue?.value || 0,
        unit: triggerValue?.unit || "",
        referenceRange: {
          min: thresholdValue?.min || 0,
          max: thresholdValue?.max || 0,
        },
        title: alert.title,
        message: alert.message,
        recommendation: Array.isArray(alert.recommendations)
          ? (alert.recommendations as string[])[0] || ""
          : "",
        contactProvider: alert.severity === "critical" || alert.severity === "high",
        createdAt: alert.createdAt,
        acknowledgedAt: alert.acknowledgedAt || undefined,
        resolvedAt: alert.resolvedAt || undefined,
      };
    });
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(sensorAlerts)
      .set({ acknowledgedAt: new Date() })
      .where(
        and(
          eq(sensorAlerts.id, alertId),
          eq(sensorAlerts.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async resolveAlert(alertId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(sensorAlerts)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(sensorAlerts.id, alertId),
          eq(sensorAlerts.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  async getCriticalAlertCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sensorAlerts)
      .where(
        and(
          eq(sensorAlerts.userId, userId),
          eq(sensorAlerts.status, "active"),
          eq(sensorAlerts.severity, "critical")
        )
      );

    return result[0]?.count || 0;
  }

  async scanHealthRecordsForAlerts(userId: string): Promise<SafetyAlert[]> {
    const records = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, userId))
      .orderBy(desc(healthRecords.date))
      .limit(100);

    const alerts: SafetyAlert[] = [];

    for (const record of records) {
      const details = record.details as Record<string, unknown> | null;
      if (!details) continue;

      const vitalMappings: Array<{ key: string; vitalType: string; unit: string }> = [
        { key: "systolic", vitalType: "blood_pressure_systolic", unit: "mmHg" },
        { key: "diastolic", vitalType: "blood_pressure_diastolic", unit: "mmHg" },
        { key: "heartRate", vitalType: "heart_rate", unit: "bpm" },
        { key: "pulse", vitalType: "heart_rate", unit: "bpm" },
        { key: "respiratoryRate", vitalType: "respiratory_rate", unit: "breaths/min" },
        { key: "oxygenSaturation", vitalType: "oxygen_saturation", unit: "%" },
        { key: "spo2", vitalType: "oxygen_saturation", unit: "%" },
        { key: "temperature", vitalType: "body_temperature", unit: "°F" },
        { key: "glucose", vitalType: "blood_glucose_random", unit: "mg/dL" },
        { key: "a1c", vitalType: "hemoglobin_a1c", unit: "%" },
        { key: "hba1c", vitalType: "hemoglobin_a1c", unit: "%" },
        { key: "cholesterol", vitalType: "cholesterol_total", unit: "mg/dL" },
        { key: "ldl", vitalType: "cholesterol_ldl", unit: "mg/dL" },
        { key: "hdl", vitalType: "cholesterol_hdl", unit: "mg/dL" },
        { key: "triglycerides", vitalType: "triglycerides", unit: "mg/dL" },
        { key: "creatinine", vitalType: "creatinine", unit: "mg/dL" },
        { key: "egfr", vitalType: "egfr", unit: "mL/min/1.73m²" },
        { key: "potassium", vitalType: "potassium", unit: "mEq/L" },
        { key: "sodium", vitalType: "sodium", unit: "mEq/L" },
        { key: "bmi", vitalType: "bmi", unit: "kg/m²" },
      ];

      for (const mapping of vitalMappings) {
        const value = details[mapping.key];
        if (typeof value === "number") {
          const alert = await this.checkAndCreateAlert(
            userId,
            mapping.vitalType,
            value,
            mapping.unit,
            record.id
          );
          if (alert) {
            alerts.push(alert);
          }
        }
      }
    }

    return alerts;
  }
}

export const clinicalSafetyAlertsService = ClinicalSafetyAlertsService.getInstance();
