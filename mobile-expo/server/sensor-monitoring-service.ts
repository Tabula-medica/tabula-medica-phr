import { storage } from "./storage";
import type { SensorReading, SensorThreshold } from "@shared/schema";

export type SensorValuePayload =
  | { systolic: number; diastolic: number }
  | { value: number }
  | { bpm: number }
  | { percentage: number }
  | { kg: number }
  | { celsius: number }
  | { count: number }
  | { hours: number; quality: number }
  | { ms: number }
  | Record<string, number>;

export interface SensorThresholdBound {
  systolic?: number;
  diastolic?: number;
  value?: number;
  bpm?: number;
  percentage?: number;
}

export interface SensorAnalysisResult {
  status: "complete" | "no_numeric_data" | "error";
  message?: string;
  dataType?: string;
  period?: { start: unknown; end: unknown; readingCount: number };
  statistics?: { average: number; minimum: number; maximum: number; standardDeviation: number };
  trend?: { direction: "increasing" | "decreasing" | "stable"; description: string };
  anomalies?: { count: number; readings: SensorReading[] };
  insights?: string[];
}

const DEVICE_SENSOR_MAP: Record<string, string[]> = {
  blood_pressure_monitor: ["blood_pressure", "heart_rate"],
  glucose_meter: ["glucose"],
  pulse_oximeter: ["spo2", "heart_rate"],
  heart_rate_monitor: ["heart_rate", "hrv"],
  smart_scale: ["weight"],
  thermometer: ["temperature"],
  fitness_tracker: ["steps", "heart_rate", "calories", "sleep"],
  cgm: ["glucose"],
  ecg_monitor: ["ecg", "heart_rate"],
  spirometer: ["respiratory_rate"],
  sleep_tracker: ["sleep", "heart_rate"],
};

const SENSOR_UNITS: Record<string, string> = {
  blood_pressure: "mmHg",
  glucose: "mg/dL",
  heart_rate: "bpm",
  spo2: "%",
  weight: "kg",
  temperature: "°C",
  steps: "steps",
  sleep: "hours",
  hrv: "ms",
  calories: "kcal",
  respiratory_rate: "breaths/min",
  ecg: "mV",
};

export function getSensorTypesForDevice(deviceType: string): string[] {
  return DEVICE_SENSOR_MAP[deviceType] ?? [];
}

export function getSensorUnit(dataType: string): string {
  return SENSOR_UNITS[dataType] ?? "";
}

export function generateMockSensorValue(dataType: string): SensorValuePayload {
  switch (dataType) {
    case "blood_pressure":
      return { systolic: 110 + Math.floor(Math.random() * 30), diastolic: 70 + Math.floor(Math.random() * 15) };
    case "glucose":
      return { value: 80 + Math.floor(Math.random() * 60) };
    case "heart_rate":
      return { bpm: 60 + Math.floor(Math.random() * 40) };
    case "spo2":
      return { percentage: 95 + Math.floor(Math.random() * 5) };
    case "weight":
      return { kg: 65 + Math.random() * 20 };
    case "temperature":
      return { celsius: 36.2 + Math.random() * 1.5 };
    case "steps":
      return { count: Math.floor(Math.random() * 15000) };
    case "sleep":
      return { hours: 5 + Math.random() * 4, quality: Math.floor(Math.random() * 100) };
    case "hrv":
      return { ms: 30 + Math.floor(Math.random() * 70) };
    default:
      return { value: Math.random() * 100 };
  }
}

interface ReadingForAlertCheck {
  id: string;
  dataType: string;
  value: unknown;
}

export interface AlertCheckResult {
  alerted: boolean;
  severity?: "warning" | "critical";
  title?: string;
}

/**
 * Evaluate a sensor reading against the user's configured threshold and
 * create a SensorAlert row if it crosses the configured bounds. Returns
 * a structured result so callers can surface partial failures instead of
 * silently swallowing errors. Throws if persistence fails so the caller
 * can decide whether to log, retry, or report a partial-failure response.
 */
export async function checkAndCreateAlert(
  userId: string,
  deviceId: string | null,
  reading: ReadingForAlertCheck,
): Promise<AlertCheckResult> {
  const threshold: SensorThreshold | undefined = await storage.getSensorThreshold(userId, reading.dataType);
  if (!threshold || !threshold.isEnabled) return { alerted: false };

  const minVal = (threshold.minValue ?? undefined) as SensorThresholdBound | undefined;
  const maxVal = (threshold.maxValue ?? undefined) as SensorThresholdBound | undefined;
  const value = reading.value as Record<string, number>;

  let isAnomaly = false;
  let severity: "warning" | "critical" = "warning";
  let title = "";
  let message = "";

  if (reading.dataType === "blood_pressure" && typeof value.systolic === "number" && typeof value.diastolic === "number") {
    if (minVal?.systolic !== undefined && value.systolic < minVal.systolic) {
      isAnomaly = true;
      title = "Low Blood Pressure Detected";
      message = `Your systolic blood pressure (${value.systolic} mmHg) is below your threshold.`;
      severity = value.systolic < 90 ? "critical" : "warning";
    }
    if (maxVal?.systolic !== undefined && value.systolic > maxVal.systolic) {
      isAnomaly = true;
      title = "High Blood Pressure Detected";
      message = `Your systolic blood pressure (${value.systolic} mmHg) is above your threshold.`;
      severity = value.systolic > 180 ? "critical" : "warning";
    }
  } else if (reading.dataType === "glucose" && typeof value.value === "number") {
    if (minVal?.value !== undefined && value.value < minVal.value) {
      isAnomaly = true;
      title = "Low Blood Glucose Detected";
      message = `Your blood glucose (${value.value} mg/dL) is below your threshold.`;
      severity = value.value < 70 ? "critical" : "warning";
    }
    if (maxVal?.value !== undefined && value.value > maxVal.value) {
      isAnomaly = true;
      title = "High Blood Glucose Detected";
      message = `Your blood glucose (${value.value} mg/dL) is above your threshold.`;
      severity = value.value > 250 ? "critical" : "warning";
    }
  } else if (reading.dataType === "heart_rate" && typeof value.bpm === "number") {
    if (minVal?.bpm !== undefined && value.bpm < minVal.bpm) {
      isAnomaly = true;
      title = "Low Heart Rate Detected";
      message = `Your heart rate (${value.bpm} bpm) is below your threshold.`;
      severity = value.bpm < 50 ? "critical" : "warning";
    }
    if (maxVal?.bpm !== undefined && value.bpm > maxVal.bpm) {
      isAnomaly = true;
      title = "High Heart Rate Detected";
      message = `Your heart rate (${value.bpm} bpm) is above your threshold.`;
      severity = value.bpm > 120 ? "critical" : "warning";
    }
  } else if (reading.dataType === "spo2" && typeof value.percentage === "number") {
    if (minVal?.percentage !== undefined && value.percentage < minVal.percentage) {
      isAnomaly = true;
      title = "Low Oxygen Saturation Detected";
      message = `Your oxygen saturation (${value.percentage}%) is below your threshold.`;
      severity = value.percentage < 90 ? "critical" : "warning";
    }
  }

  if (!isAnomaly) return { alerted: false };

  await storage.createSensorAlert({
    userId,
    deviceId,
    readingId: reading.id,
    alertType: "threshold",
    severity,
    title,
    message,
    dataType: reading.dataType,
    triggerValue: value,
    thresholdValue: { min: minVal ?? null, max: maxVal ?? null },
    aiAnalysis: null,
    recommendations: null,
    status: "active",
    notifiedProvider: severity === "critical",
  });
  return { alerted: true, severity, title };
}

function extractNumericValues(dataType: string, readings: ReadonlyArray<SensorReading>): number[] {
  return readings.map((r) => {
    const v = (r.value ?? {}) as Record<string, number>;
    switch (dataType) {
      case "blood_pressure": return v.systolic ?? 0;
      case "glucose": return v.value ?? 0;
      case "heart_rate": return v.bpm ?? 0;
      case "spo2": return v.percentage ?? 0;
      case "weight": return v.kg ?? 0;
      default: return 0;
    }
  });
}

function generateInsights(dataType: string, avg: number, trend: string, anomalyCount: number): string[] {
  const insights: string[] = [];
  if (dataType === "blood_pressure") {
    if (avg < 90) insights.push("Your average blood pressure is on the lower side. Consider discussing with your healthcare provider.");
    else if (avg > 140) insights.push("Your average blood pressure is elevated. Regular monitoring and lifestyle modifications may help.");
    else insights.push("Your blood pressure readings are within a healthy range.");
  } else if (dataType === "glucose") {
    if (avg < 80) insights.push("Your average glucose is on the lower end. Ensure you're eating regular meals.");
    else if (avg > 140) insights.push("Your average glucose is elevated. Consider reviewing your diet and activity levels.");
    else insights.push("Your glucose readings are within a healthy range.");
  } else if (dataType === "heart_rate") {
    if (avg < 60) insights.push("Your average heart rate suggests good cardiovascular fitness.");
    else if (avg > 100) insights.push("Your resting heart rate is elevated. Consider stress management and exercise.");
    else insights.push("Your heart rate is within a normal range.");
  }
  if (trend === "increasing") insights.push(`Your ${dataType.replace("_", " ")} values show an increasing trend over this period.`);
  else if (trend === "decreasing") insights.push(`Your ${dataType.replace("_", " ")} values show a decreasing trend over this period.`);
  if (anomalyCount > 0) insights.push(`${anomalyCount} unusual reading(s) were detected. Review these for potential causes.`);
  return insights;
}

/**
 * Compute statistics, trend, and anomalies (z-score > 2) over a set of
 * sensor readings. Throws on unexpected errors so callers can return a
 * 5xx instead of silently masking failures.
 */
export async function analyzeReadings(
  dataType: string,
  readings: ReadonlyArray<SensorReading>,
): Promise<SensorAnalysisResult> {
  const numericValues = extractNumericValues(dataType, readings);
  if (numericValues.length === 0) {
    return { status: "no_numeric_data", message: "Unable to extract numeric values for analysis" };
  }

  const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const stdDev = Math.sqrt(numericValues.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / numericValues.length);

  let trend: "stable" | "increasing" | "decreasing" = "stable";
  if (numericValues.length >= 3) {
    const half = Math.floor(numericValues.length / 2);
    const firstAvg = numericValues.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const secondAvg = numericValues.slice(half).reduce((a, b) => a + b, 0) / (numericValues.length - half);
    const change = firstAvg === 0 ? 0 : ((secondAvg - firstAvg) / firstAvg) * 100;
    if (change > 5) trend = "increasing";
    else if (change < -5) trend = "decreasing";
  }

  const denom = stdDev || 1;
  const anomalies = readings.filter((_r, i) => Math.abs((numericValues[i] - avg) / denom) > 2);
  const timestamps = readings.map((r) => r.timestamp);

  return {
    status: "complete",
    dataType,
    period: {
      start: timestamps[timestamps.length - 1],
      end: timestamps[0],
      readingCount: readings.length,
    },
    statistics: {
      average: Math.round(avg * 10) / 10,
      minimum: Math.round(min * 10) / 10,
      maximum: Math.round(max * 10) / 10,
      standardDeviation: Math.round(stdDev * 10) / 10,
    },
    trend: {
      direction: trend,
      description: trend === "increasing" ? "Values are trending upward"
        : trend === "decreasing" ? "Values are trending downward"
        : "Values are relatively stable",
    },
    anomalies: { count: anomalies.length, readings: anomalies.slice(0, 5) },
    insights: generateInsights(dataType, avg, trend, anomalies.length),
  };
}
