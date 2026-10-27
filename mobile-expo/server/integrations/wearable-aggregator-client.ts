import { storage } from "../storage";
import type { InsertHealthRecord } from "@shared/schema";
import { AuditService, AuditAction, ResourceType } from "../compliance/audit-service";

export type WearableProvider = "terra" | "vital" | "tryvital";

export interface WearableConfig {
  provider: WearableProvider;
  apiKey: string;
  devId?: string;
  environment: "sandbox" | "production";
}

export interface WearableConnection {
  id: string;
  userId: string;
  provider: WearableProvider;
  terraUserId?: string;
  connectedDevices: ConnectedDevice[];
  createdAt: Date;
  lastSyncAt?: Date;
}

export interface ConnectedDevice {
  id: string;
  provider: string;
  type: DeviceType;
  name: string;
  lastSync?: Date;
  status: "connected" | "disconnected" | "error";
}

export type DeviceType = 
  | "fitness_tracker"
  | "smartwatch"
  | "smart_scale"
  | "blood_pressure_monitor"
  | "glucose_monitor"
  | "sleep_tracker"
  | "heart_rate_monitor"
  | "pulse_oximeter"
  | "thermometer"
  | "activity_tracker"
  | "other";

export interface WearableData {
  activity?: ActivityData[];
  sleep?: SleepData[];
  body?: BodyData[];
  daily?: DailyData[];
  nutrition?: NutritionData[];
}

export interface ActivityData {
  id: string;
  startTime: Date;
  endTime: Date;
  type: string;
  calories?: number;
  steps?: number;
  distance?: number;
  heartRateAvg?: number;
  heartRateMax?: number;
  duration?: number;
}

export interface SleepData {
  id: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  duration: number;
  efficiency?: number;
  stages?: {
    deep?: number;
    light?: number;
    rem?: number;
    awake?: number;
  };
  heartRateAvg?: number;
  respiratoryRate?: number;
}

export interface BodyData {
  id: string;
  date: Date;
  weight?: number;
  bodyFat?: number;
  bmi?: number;
  muscleMass?: number;
  boneMass?: number;
  hydration?: number;
}

export interface DailyData {
  id: string;
  date: Date;
  steps?: number;
  calories?: number;
  distance?: number;
  floorsClimbed?: number;
  activeMinutes?: number;
  restingHeartRate?: number;
  heartRateVariability?: number;
  stressLevel?: number;
  oxygenSaturation?: number;
}

export interface NutritionData {
  id: string;
  date: Date;
  calories?: number;
  carbohydrates?: number;
  protein?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  water?: number;
}

const TERRA_ENDPOINTS = {
  sandbox: "https://api.tryterra.co/v2",
  production: "https://api.tryterra.co/v2",
};

const SUPPORTED_WEARABLE_SOURCES = {
  terra: {
    name: "Terra API",
    description: "Connect to 100+ wearable devices and health apps",
    supportedDevices: [
      { id: "apple_health", name: "Apple Health", type: "smartwatch" as DeviceType },
      { id: "google_fit", name: "Google Fit", type: "fitness_tracker" as DeviceType },
      { id: "fitbit", name: "Fitbit", type: "fitness_tracker" as DeviceType },
      { id: "garmin", name: "Garmin", type: "smartwatch" as DeviceType },
      { id: "oura", name: "Oura Ring", type: "sleep_tracker" as DeviceType },
      { id: "whoop", name: "WHOOP", type: "fitness_tracker" as DeviceType },
      { id: "withings", name: "Withings", type: "smart_scale" as DeviceType },
      { id: "polar", name: "Polar", type: "heart_rate_monitor" as DeviceType },
      { id: "samsung", name: "Samsung Health", type: "smartwatch" as DeviceType },
      { id: "peloton", name: "Peloton", type: "fitness_tracker" as DeviceType },
      { id: "strava", name: "Strava", type: "activity_tracker" as DeviceType },
      { id: "dexcom", name: "Dexcom CGM", type: "glucose_monitor" as DeviceType },
      { id: "freestyle_libre", name: "FreeStyle Libre", type: "glucose_monitor" as DeviceType },
      { id: "omron", name: "Omron", type: "blood_pressure_monitor" as DeviceType },
      { id: "suunto", name: "Suunto", type: "smartwatch" as DeviceType },
      { id: "polar_vantage", name: "Polar Vantage", type: "smartwatch" as DeviceType },
      { id: "amazfit", name: "Amazfit / Zepp", type: "smartwatch" as DeviceType },
      { id: "coros", name: "COROS", type: "smartwatch" as DeviceType },
      { id: "myfitnesspal", name: "MyFitnessPal", type: "activity_tracker" as DeviceType },
      { id: "cronometer", name: "Cronometer", type: "activity_tracker" as DeviceType },
    ],
  },
  vital: {
    name: "Vital API",
    description: "Health data aggregation for wearables and labs",
    supportedDevices: [
      { id: "apple_health", name: "Apple Health", type: "smartwatch" as DeviceType },
      { id: "fitbit", name: "Fitbit", type: "fitness_tracker" as DeviceType },
      { id: "garmin", name: "Garmin", type: "smartwatch" as DeviceType },
      { id: "oura", name: "Oura Ring", type: "sleep_tracker" as DeviceType },
    ],
  },
};

export class WearableAggregatorClient {
  private config: WearableConfig;
  private baseUrl: string;

  constructor(config: WearableConfig) {
    this.config = config;
    this.baseUrl = TERRA_ENDPOINTS[config.environment];
  }

  async generateWidgetSession(userId: string, referenceId: string): Promise<{
    sessionUrl: string;
    sessionId: string;
  }> {
    const response = await fetch(`${this.baseUrl}/auth/generateWidgetSession`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "dev-id": this.config.devId || "",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify({
        reference_id: referenceId,
        providers: this.getDefaultProviders(),
        language: "en",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to generate widget session: ${error}`);
    }

    const data = await response.json();
    return {
      sessionUrl: data.url,
      sessionId: data.session_id,
    };
  }

  private getDefaultProviders(): string[] {
    return [
      "APPLE",
      "GOOGLE",
      "FITBIT",
      "GARMIN",
      "OURA",
      "WHOOP",
      "WITHINGS",
      "POLAR",
      "SAMSUNG",
      "PELOTON",
      "STRAVA",
    ];
  }

  async getUserConnections(terraUserId: string): Promise<ConnectedDevice[]> {
    const response = await fetch(`${this.baseUrl}/user?user_id=${terraUserId}`, {
      headers: {
        "dev-id": this.config.devId || "",
        "x-api-key": this.config.apiKey,
      },
    });

    if (!response.ok) {
      console.error("Failed to get user connections:", await response.text());
      return [];
    }

    const data = await response.json();
    
    if (data.user && Array.isArray(data.user.providers)) {
      return data.user.providers.map((provider: any) => ({
        id: provider.provider_id || crypto.randomUUID(),
        provider: provider.provider,
        type: this.inferDeviceType(provider.provider),
        name: provider.provider,
        lastSync: provider.last_webhook_update ? new Date(provider.last_webhook_update) : undefined,
        status: provider.status === "active" ? "connected" : "disconnected",
      }));
    }

    return [];
  }

  private inferDeviceType(provider: string): DeviceType {
    const p = provider.toLowerCase();
    if (p.includes("scale") || p === "withings") return "smart_scale";
    if (p.includes("sleep") || p === "oura") return "sleep_tracker";
    if (p.includes("watch") || p === "apple" || p === "garmin" || p === "samsung") return "smartwatch";
    if (p.includes("glucose") || p === "dexcom" || p === "freestyle") return "glucose_monitor";
    if (p.includes("pressure") || p === "omron") return "blood_pressure_monitor";
    if (p.includes("heart") || p === "polar") return "heart_rate_monitor";
    return "fitness_tracker";
  }

  async getActivityData(terraUserId: string, startDate: Date, endDate: Date): Promise<ActivityData[]> {
    const response = await fetch(
      `${this.baseUrl}/activity?user_id=${terraUserId}&start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}`,
      {
        headers: {
          "dev-id": this.config.devId || "",
          "x-api-key": this.config.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get activity data: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapActivityData(data.data || []);
  }

  private mapActivityData(data: any[]): ActivityData[] {
    return data.map((item: any) => ({
      id: item.metadata?.id || crypto.randomUUID(),
      startTime: new Date(item.metadata?.start_time || item.start_time),
      endTime: new Date(item.metadata?.end_time || item.end_time),
      type: item.metadata?.type || "activity",
      calories: item.calories_data?.total_burned_calories,
      steps: item.distance_data?.steps,
      distance: item.distance_data?.distance_meters,
      heartRateAvg: item.heart_rate_data?.avg_hr_bpm,
      heartRateMax: item.heart_rate_data?.max_hr_bpm,
      duration: item.active_duration_data?.activity_seconds,
    }));
  }

  async getSleepData(terraUserId: string, startDate: Date, endDate: Date): Promise<SleepData[]> {
    const response = await fetch(
      `${this.baseUrl}/sleep?user_id=${terraUserId}&start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}`,
      {
        headers: {
          "dev-id": this.config.devId || "",
          "x-api-key": this.config.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get sleep data: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapSleepData(data.data || []);
  }

  private mapSleepData(data: any[]): SleepData[] {
    return data.map((item: any) => ({
      id: item.metadata?.id || crypto.randomUUID(),
      date: new Date(item.metadata?.start_time || item.start_time),
      startTime: new Date(item.metadata?.start_time || item.start_time),
      endTime: new Date(item.metadata?.end_time || item.end_time),
      duration: item.sleep_durations_data?.total_duration?.duration_asleep_state_seconds || 0,
      efficiency: item.sleep_durations_data?.sleep_efficiency,
      stages: {
        deep: item.sleep_durations_data?.sleep_stages?.duration_deep_sleep_state_seconds,
        light: item.sleep_durations_data?.sleep_stages?.duration_light_sleep_state_seconds,
        rem: item.sleep_durations_data?.sleep_stages?.duration_REM_sleep_state_seconds,
        awake: item.sleep_durations_data?.sleep_stages?.duration_awake_state_seconds,
      },
      heartRateAvg: item.heart_rate_data?.avg_hr_bpm,
      respiratoryRate: item.respiration_data?.avg_breaths_per_min,
    }));
  }

  async getBodyData(terraUserId: string, startDate: Date, endDate: Date): Promise<BodyData[]> {
    const response = await fetch(
      `${this.baseUrl}/body?user_id=${terraUserId}&start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}`,
      {
        headers: {
          "dev-id": this.config.devId || "",
          "x-api-key": this.config.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get body data: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapBodyData(data.data || []);
  }

  private mapBodyData(data: any[]): BodyData[] {
    return data.map((item: any) => ({
      id: item.metadata?.id || crypto.randomUUID(),
      date: new Date(item.metadata?.start_time || item.start_time || new Date()),
      weight: item.measurements_data?.weight_kg,
      bodyFat: item.measurements_data?.body_fat_percentage,
      bmi: item.measurements_data?.bmi,
      muscleMass: item.measurements_data?.muscle_mass_kg,
      boneMass: item.measurements_data?.bone_mass_kg,
      hydration: item.measurements_data?.hydration_percentage,
    }));
  }

  async getDailyData(terraUserId: string, startDate: Date, endDate: Date): Promise<DailyData[]> {
    const response = await fetch(
      `${this.baseUrl}/daily?user_id=${terraUserId}&start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}`,
      {
        headers: {
          "dev-id": this.config.devId || "",
          "x-api-key": this.config.apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get daily data: ${response.statusText}`);
    }

    const data = await response.json();
    return this.mapDailyData(data.data || []);
  }

  private mapDailyData(data: any[]): DailyData[] {
    return data.map((item: any) => ({
      id: item.metadata?.id || crypto.randomUUID(),
      date: new Date(item.metadata?.start_time || item.start_time || new Date()),
      steps: item.distance_data?.steps,
      calories: item.calories_data?.total_burned_calories,
      distance: item.distance_data?.distance_meters,
      floorsClimbed: item.distance_data?.floors_climbed,
      activeMinutes: item.active_duration_data?.activity_seconds ? Math.round(item.active_duration_data.activity_seconds / 60) : undefined,
      restingHeartRate: item.heart_rate_data?.resting_hr_bpm,
      heartRateVariability: item.heart_rate_data?.hrv_avg_rmssd,
      stressLevel: item.stress_data?.stress_level_avg,
      oxygenSaturation: item.oxygen_data?.avg_saturation_percentage,
    }));
  }

  async syncToDatabase(
    userId: string,
    sourceId: string,
    terraUserId: string,
    daysBack: number = 30,
    req?: any
  ): Promise<{ imported: number; errors: number }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    let imported = 0;
    let errors = 0;

    try {
      const [activity, sleep, body, daily] = await Promise.all([
        this.getActivityData(terraUserId, startDate, endDate).catch(() => []),
        this.getSleepData(terraUserId, startDate, endDate).catch(() => []),
        this.getBodyData(terraUserId, startDate, endDate).catch(() => []),
        this.getDailyData(terraUserId, startDate, endDate).catch(() => []),
      ]);

      for (const item of activity) {
        try {
          await storage.createHealthRecord({
            userId,
            sourceId,
            type: "activity",
            title: `${item.type} Activity`,
            summary: `${item.steps || 0} steps, ${item.calories || 0} calories`,
            date: item.startTime,
            provider: "Wearable Device",
            details: item as any,
            isManual: false,
          });
          imported++;
        } catch (e) {
          errors++;
        }
      }

      for (const item of sleep) {
        try {
          const hours = Math.floor(item.duration / 3600);
          const mins = Math.floor((item.duration % 3600) / 60);
          await storage.createHealthRecord({
            userId,
            sourceId,
            type: "sleep",
            title: "Sleep Session",
            summary: `${hours}h ${mins}m sleep, ${item.efficiency || 0}% efficiency`,
            date: item.date,
            provider: "Wearable Device",
            details: item as any,
            isManual: false,
          });
          imported++;
        } catch (e) {
          errors++;
        }
      }

      for (const item of body) {
        try {
          await storage.createHealthRecord({
            userId,
            sourceId,
            type: "vital",
            title: "Body Measurements",
            summary: `Weight: ${item.weight || 0} kg, BMI: ${item.bmi || 0}`,
            date: item.date,
            provider: "Wearable Device",
            details: item as any,
            isManual: false,
          });
          imported++;
        } catch (e) {
          errors++;
        }
      }

      for (const item of daily) {
        try {
          await storage.createHealthRecord({
            userId,
            sourceId,
            type: "daily_summary",
            title: "Daily Health Summary",
            summary: `${item.steps || 0} steps, ${item.calories || 0} cal, ${item.activeMinutes || 0} active mins`,
            date: item.date,
            provider: "Wearable Device",
            details: item as any,
            isManual: false,
          });
          imported++;
        } catch (e) {
          errors++;
        }
      }

      if (req) {
        AuditService.phiAccess(req, AuditAction.CREATE_PHI, ResourceType.HEALTH_RECORD, undefined, {
          phiDetails: {
            recordCount: imported,
            accessReason: `Wearable sync from ${this.config.provider}`,
          },
        });
      }
    } catch (error) {
      console.error("Wearable sync error:", error);
    }

    return { imported, errors };
  }
}

export function getSupportedWearableSources(): typeof SUPPORTED_WEARABLE_SOURCES {
  return SUPPORTED_WEARABLE_SOURCES;
}

export function createWearableClient(provider: WearableProvider = "terra"): WearableAggregatorClient | null {
  const apiKey = process.env.TERRA_API_KEY;
  const devId = process.env.TERRA_DEV_ID;
  const environment = (process.env.TERRA_ENVIRONMENT || "sandbox") as "sandbox" | "production";

  if (!apiKey) {
    return null;
  }

  return new WearableAggregatorClient({
    provider,
    apiKey,
    devId,
    environment,
  });
}
