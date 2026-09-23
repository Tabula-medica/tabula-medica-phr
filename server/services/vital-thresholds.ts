/**
 * Shared clinical vital-sign threshold checking.
 *
 * Extracted from health-tracking-routes.ts so every ingestion path —
 * manual patient entry, a connected RPM device (e.g. VitalFriend), or a
 * fitness-app reading that happens to overlap a clinical vital type
 * (resting heart rate, weight, oxygen saturation) — runs through the same
 * abnormal-range logic and writes to the same monitoring_alerts table.
 * Do not duplicate this table elsewhere; add a new source instead.
 */
import { db } from "../db";
import { monitoringAlertsTable, vitalSignsTable, type VitalSignType } from "@shared/schema";

// Optionally accepts a transaction handle (from `db.transaction(async (tx) => ...)`)
// so callers that need atomicity with other writes — e.g. a webhook handler
// wrapped in `withDeliveryClaim` — can pass `tx` and have the vital +
// threshold-alert writes commit or roll back together with everything else.
// Defaults to the module-level `db` for existing non-transactional callers
// (manual vital entry).
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export const VITAL_THRESHOLDS: Record<
  string,
  { low?: number; high?: number; critical_low?: number; critical_high?: number; unit: string }
> = {
  blood_pressure_systolic: { low: 90, high: 140, critical_low: 70, critical_high: 180, unit: "mmHg" },
  blood_pressure_diastolic: { low: 60, high: 90, critical_low: 40, critical_high: 120, unit: "mmHg" },
  heart_rate: { low: 60, high: 100, critical_low: 40, critical_high: 150, unit: "bpm" },
  blood_glucose: { low: 70, high: 140, critical_low: 54, critical_high: 250, unit: "mg/dL" },
  weight: { unit: "lbs" },
  temperature: { low: 97, high: 99.5, critical_low: 95, critical_high: 103, unit: "°F" },
  oxygen_saturation: { low: 95, critical_low: 90, unit: "%" },
  respiratory_rate: { low: 12, high: 20, critical_low: 8, critical_high: 30, unit: "breaths/min" },
};

/**
 * Insert an abnormal-range monitoring alert if `value` falls outside the
 * clinical threshold for `vitalType`. No-ops for vital types without a
 * defined threshold (e.g. weight has no universal normal range).
 */
export async function checkVitalThresholds(
  profileId: string,
  vitalType: string,
  value: number,
  vitalSignId: string,
  tx: DbClient = db,
): Promise<{ severity: "low" | "medium" | "high" | "critical" } | null> {
  const thresholds = VITAL_THRESHOLDS[vitalType];
  if (!thresholds) return null;

  let severity: "low" | "medium" | "high" | "critical" | null = null;
  let message = "";

  if (thresholds.critical_high && value >= thresholds.critical_high) {
    severity = "critical";
    message = `Critical high ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (threshold: ${thresholds.critical_high})`;
  } else if (thresholds.critical_low && value <= thresholds.critical_low) {
    severity = "critical";
    message = `Critical low ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (threshold: ${thresholds.critical_low})`;
  } else if (thresholds.high && value >= thresholds.high) {
    severity = "high";
    message = `High ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (normal: <${thresholds.high})`;
  } else if (thresholds.low && value <= thresholds.low) {
    severity = "medium";
    message = `Low ${vitalType.replace(/_/g, " ")}: ${value} ${thresholds.unit} (normal: >${thresholds.low})`;
  }

  if (severity) {
    await tx.insert(monitoringAlertsTable).values({
      profileId,
      vitalSignId,
      alertType: "vital_threshold",
      severity,
      title: `Abnormal ${vitalType.replace(/_/g, " ")} reading`,
      message,
      threshold: thresholds.high?.toString() || thresholds.low?.toString() || "",
      actualValue: value.toString(),
      status: "pending",
    });
  }

  return severity ? { severity } : null;
}

export interface IngestVitalReadingInput {
  profileId: string;
  vitalType: VitalSignType | string;
  value: number;
  unit: string;
  recordedAt?: Date;
  source: string;
  deviceId?: string;
  notes?: string;
}

/**
 * Write a clinical vital reading (from RPM device ingestion or a fitness
 * app whose data overlaps a clinical vital type) into vital_signs and run
 * it through threshold checking, exactly like a manually-entered vital.
 */
export async function ingestVitalReading(input: IngestVitalReadingInput, tx: DbClient = db) {
  const [vital] = await tx
    .insert(vitalSignsTable)
    .values({
      profileId: input.profileId,
      vitalType: input.vitalType,
      value: input.value.toString(),
      unit: input.unit,
      recordedAt: input.recordedAt ?? new Date(),
      source: input.source,
      deviceId: input.deviceId,
      notes: input.notes,
    })
    .returning();

  await checkVitalThresholds(input.profileId, input.vitalType, input.value, vital.id, tx);

  return vital;
}
