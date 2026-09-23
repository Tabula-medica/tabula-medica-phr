/**
 * Terra API integration — read-only fitness-app data aggregation.
 *
 * Terra (https://tryterra.co) is a wearable/fitness-data aggregator that
 * exposes one API across 20+ consumer platforms (Fitbit, Garmin, Oura,
 * Withings, Google Fit, Apple Health, Samsung Health, WHOOP, Polar,
 * Strava, ...). Its widget-based auth flow only ever grants Terra
 * read access to the source platform's API on the user's behalf — there
 * is no write-back path — which is exactly the "read only" fitness-app
 * access this integration is scoped to.
 *
 * Endpoints and payload shapes below were verified against Terra's public
 * API reference (docs.tryterra.co) as of this writing:
 *   - POST /v2/auth/generateWidgetSession
 *   - POST /v2/auth/deauthenticateUser
 *   - Webhook envelope: { type, user: { user_id, provider, ... }, data: [...] }
 *   - Webhook signing: `terra-signature: t=<unix_ts>,v1=<hex hmac-sha256>`,
 *     computed over `${t}.${rawBody}` using the dashboard signing secret.
 *
 * Per-data-type field paths inside `data[]` (heart rate, body composition,
 * steps, sleep, etc.) are mapped defensively in mapTerraPayloadToReadings
 * below using Terra's commonly documented summary fields. If you enable a
 * data type this file doesn't explicitly handle, the raw payload is still
 * preserved (see wellness_metrics.raw_payload / the unmapped-type log) —
 * cross-check https://docs.tryterra.co/reference/health-and-fitness-api/data-models
 * before relying on a new field path in a clinical context.
 */
import crypto from "crypto";
import type { FitnessProvider } from "@shared/schema";

const TERRA_BASE_URL = "https://api.tryterra.co/v2";

// Terra's own provider/"resource" codes for the widget's `providers` param.
// See https://docs.tryterra.co/reference/health-and-fitness-api/core-concepts
const TERRA_PROVIDER_CODES: Record<FitnessProvider, string> = {
  apple_health: "APPLE",
  google_fit: "GOOGLE",
  fitbit: "FITBIT",
  oura: "OURA",
  garmin: "GARMIN",
  whoop: "WHOOP",
  samsung_health: "SAMSUNG",
  withings: "WITHINGS",
  polar: "POLAR",
  strava: "STRAVA",
};

function getConfig() {
  return {
    apiKey: process.env.TERRA_API_KEY || "",
    devId: process.env.TERRA_DEV_ID || "",
    signingSecret: process.env.TERRA_SIGNING_SECRET || "",
  };
}

export function isTerraConfigured(): boolean {
  const { apiKey, devId } = getConfig();
  return Boolean(apiKey && devId);
}

export function terraProviderCode(provider: FitnessProvider): string {
  return TERRA_PROVIDER_CODES[provider];
}

export interface GenerateWidgetSessionResult {
  sessionId: string;
  widgetUrl: string;
  expiresInSeconds: number;
}

/**
 * Real call to Terra's "Generate Widget Session" endpoint. Requires
 * TERRA_API_KEY / TERRA_DEV_ID to be set — throws if they aren't, so
 * callers must not silently fall back to mock data.
 */
export async function generateWidgetSession(
  provider: FitnessProvider,
  referenceId: string,
  redirectBaseUrl: string,
): Promise<GenerateWidgetSessionResult> {
  const { apiKey, devId } = getConfig();
  if (!apiKey || !devId) {
    throw new Error(
      "Terra is not configured: set TERRA_API_KEY and TERRA_DEV_ID (from the Terra dashboard) before connecting fitness apps.",
    );
  }

  const res = await fetch(`${TERRA_BASE_URL}/auth/generateWidgetSession`, {
    method: "POST",
    headers: {
      "dev-id": devId,
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reference_id: referenceId,
      providers: terraProviderCode(provider),
      language: "en",
      auth_success_redirect_url: `${redirectBaseUrl}?status=success`,
      auth_failure_redirect_url: `${redirectBaseUrl}?status=failure`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Terra generateWidgetSession failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as {
    status: string;
    session_id: string;
    url: string;
    expires_in: number;
  };

  if (json.status !== "success" || !json.url) {
    throw new Error(`Terra generateWidgetSession returned an unexpected response: ${JSON.stringify(json)}`);
  }

  return {
    sessionId: json.session_id,
    widgetUrl: json.url,
    expiresInSeconds: json.expires_in,
  };
}

/**
 * Revoke Terra's access to a user's connected provider. Best-effort: a
 * failure here should not block locally marking the connection
 * disconnected, since the patient's intent (stop reading their data) must
 * win even if Terra's API is briefly unavailable.
 */
export async function deauthenticateTerraUser(terraUserId: string): Promise<{ success: boolean; error?: string }> {
  const { apiKey, devId } = getConfig();
  if (!apiKey || !devId) {
    return { success: false, error: "Terra is not configured" };
  }

  try {
    const res = await fetch(`${TERRA_BASE_URL}/auth/deauthenticateUser`, {
      method: "POST",
      headers: {
        "dev-id": devId,
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: terraUserId }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { success: false, error: `Terra deauthenticateUser failed: ${res.status} ${body}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Verify a Terra webhook's `terra-signature` header against the raw
 * request body. Fails closed: any missing config, malformed header, or
 * mismatch returns false. Callers MUST reject the webhook on false.
 *
 * Terra's documented format: `terra-signature: t=<unix_ts>,v1=<hex hmac>`
 * where the hmac is SHA-256 of `${t}.${rawBody}` keyed by the signing
 * secret from the Terra dashboard, compared in constant time.
 */
export function verifyTerraWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const { signingSecret } = getConfig();
  if (!signingSecret || !signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const timestamp = parts["t"];
  const providedSignature = parts["v1"];
  if (!timestamp || !providedSignature) return false;

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expectedSignature = crypto.createHmac("sha256", signingSecret).update(signedPayload).digest("hex");

  const expectedBuf = Buffer.from(expectedSignature, "hex");
  const providedBuf = Buffer.from(providedSignature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export interface MappedClinicalReading {
  vitalType: "heart_rate" | "weight" | "oxygen_saturation";
  value: number;
  unit: string;
  recordedAt: Date;
}

export interface MappedWellnessReading {
  metricType: "steps" | "active_minutes" | "calories_burned" | "distance_meters" | "sleep_minutes" | "sleep_score" | "hrv";
  value: number;
  unit: string;
  recordedAt: Date;
}

/**
 * Best-effort mapping from a single Terra webhook `data[]` entry to our
 * internal reading shapes, split into clinical vitals (fed into
 * vital_signs + abnormal-range alerting) and non-clinical wellness
 * metrics (fed into wellness_metrics only). Unrecognized fields are
 * simply skipped rather than thrown on, since Terra's payloads vary by
 * data type and connected provider.
 */
export function mapTerraPayloadToReadings(
  type: string,
  entry: any,
): { clinical: MappedClinicalReading[]; wellness: MappedWellnessReading[] } {
  const clinical: MappedClinicalReading[] = [];
  const wellness: MappedWellnessReading[] = [];

  const recordedAt = safeDate(
    entry?.metadata?.end_time || entry?.metadata?.start_time || entry?.metadata?.upload_date,
  );

  if (type === "daily" || type === "activity") {
    const steps = entry?.distance_data?.summary?.steps ?? entry?.distance_data?.steps;
    if (typeof steps === "number") {
      wellness.push({ metricType: "steps", value: steps, unit: "steps", recordedAt });
    }
    const activeMinutes = entry?.active_durations_data?.activity_seconds
      ? Math.round(entry.active_durations_data.activity_seconds / 60)
      : undefined;
    if (typeof activeMinutes === "number") {
      wellness.push({ metricType: "active_minutes", value: activeMinutes, unit: "minutes", recordedAt });
    }
    const calories = entry?.calories_data?.total_burned_calories;
    if (typeof calories === "number") {
      wellness.push({ metricType: "calories_burned", value: calories, unit: "kcal", recordedAt });
    }
    const distance = entry?.distance_data?.summary?.distance_meters;
    if (typeof distance === "number") {
      wellness.push({ metricType: "distance_meters", value: distance, unit: "meters", recordedAt });
    }
    const avgHr = entry?.heart_rate_data?.summary?.avg_hr_bpm;
    if (typeof avgHr === "number") {
      clinical.push({ vitalType: "heart_rate", value: avgHr, unit: "bpm", recordedAt });
    }
    const restingHr = entry?.heart_rate_data?.summary?.resting_hr_bpm;
    if (typeof restingHr === "number") {
      clinical.push({ vitalType: "heart_rate", value: restingHr, unit: "bpm", recordedAt });
    }
    const avgHrv = entry?.heart_rate_data?.summary?.avg_hrv_rmssd;
    if (typeof avgHrv === "number") {
      wellness.push({ metricType: "hrv", value: avgHrv, unit: "ms", recordedAt });
    }
    const spo2 = entry?.oxygen_data?.avg_saturation_percentage;
    if (typeof spo2 === "number") {
      clinical.push({ vitalType: "oxygen_saturation", value: spo2, unit: "%", recordedAt });
    }
  }

  if (type === "body") {
    const weightKg = entry?.body_data?.weight_kg;
    if (typeof weightKg === "number") {
      clinical.push({ vitalType: "weight", value: weightKg * 2.20462, unit: "lbs", recordedAt });
    }
    const spo2 = entry?.oxygen_data?.avg_saturation_percentage;
    if (typeof spo2 === "number") {
      clinical.push({ vitalType: "oxygen_saturation", value: spo2, unit: "%", recordedAt });
    }
    const restingHr = entry?.heart_data?.summary?.resting_hr_bpm;
    if (typeof restingHr === "number") {
      clinical.push({ vitalType: "heart_rate", value: restingHr, unit: "bpm", recordedAt });
    }
  }

  if (type === "sleep") {
    const sleepMinutes = entry?.sleep_durations_data?.asleep?.duration_asleep_state_seconds
      ? Math.round(entry.sleep_durations_data.asleep.duration_asleep_state_seconds / 60)
      : undefined;
    if (typeof sleepMinutes === "number") {
      wellness.push({ metricType: "sleep_minutes", value: sleepMinutes, unit: "minutes", recordedAt });
    }
    const sleepScore = entry?.sleep_durations_data?.other?.sleep_efficiency;
    if (typeof sleepScore === "number") {
      wellness.push({ metricType: "sleep_score", value: sleepScore, unit: "score", recordedAt });
    }
  }

  return { clinical, wellness };
}

function safeDate(value: unknown): Date {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
