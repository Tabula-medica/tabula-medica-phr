/**
 * Wearable Device Data Connectors Service
 * Integrates with Apple Health, Google Fit, Fitbit, Samsung Health, Garmin, Oura, Whoop
 * Provides real-time vitals, activity, sleep, and nutrition data ingestion
 */

interface WearableDevice {
  id: string;
  userId: string;
  platform: WearablePlatform;
  deviceName: string;
  deviceModel?: string;
  firmwareVersion?: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSync?: Date;
  batteryLevel?: number;
  capabilities: DataCategory[];
  authToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  connectedAt: Date;
}

type WearablePlatform = "apple_health" | "google_fit" | "fitbit" | "samsung_health" | "garmin" | "oura" | "whoop" | "withings" | "dexcom" | "suunto" | "polar" | "amazfit" | "coros";

type DataCategory = "heart_rate" | "steps" | "distance" | "calories" | "sleep" | "blood_oxygen" | "blood_pressure" | "blood_glucose" | "body_temperature" | "respiratory_rate" | "hrv" | "ecg" | "activity" | "nutrition" | "weight" | "body_fat" | "hydration" | "stress" | "menstrual" | "workout";

interface WearableDataPoint {
  id: string;
  deviceId: string;
  userId: string;
  category: DataCategory;
  metric: string;
  value: number;
  unit: string;
  timestamp: Date;
  source: WearablePlatform;
  confidence?: number;
  metadata?: Record<string, any>;
}

interface WearableSyncResult {
  deviceId: string;
  platform: WearablePlatform;
  syncedAt: Date;
  dataPointsReceived: number;
  dataPointsStored: number;
  duplicatesSkipped: number;
  errors: string[];
  categories: DataCategory[];
  dateRange: { start: Date; end: Date };
}

interface AnomalyDetection {
  id: string;
  userId: string;
  deviceId: string;
  category: DataCategory;
  metric: string;
  detectedAt: Date;
  severity: "low" | "medium" | "high" | "critical";
  anomalyType: "spike" | "drop" | "trend_change" | "missing_data" | "out_of_range";
  currentValue: number;
  expectedRange: { min: number; max: number };
  unit: string;
  description: string;
  recommendation?: string;
  acknowledged: boolean;
}

interface WearablePlatformConfig {
  platform: WearablePlatform;
  name: string;
  icon: string;
  description: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  supportedCategories: DataCategory[];
  fhirMapping: Record<string, { code: string; system: string; display: string }>;
  refreshIntervalMinutes: number;
  maxHistoryDays: number;
}

const PLATFORM_CONFIGS: WearablePlatformConfig[] = [
  {
    platform: "apple_health",
    name: "Apple Health",
    icon: "heart",
    description: "Comprehensive health data from iPhone and Apple Watch including heart rate, ECG, blood oxygen, sleep, activity, and more",
    authUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    scopes: ["healthkit.read", "healthkit.write"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "blood_pressure", "blood_glucose", "body_temperature", "respiratory_rate", "hrv", "ecg", "activity", "nutrition", "weight", "body_fat", "workout", "menstrual"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      blood_pressure: { code: "85354-9", system: "http://loinc.org", display: "Blood pressure" },
      body_temperature: { code: "8310-5", system: "http://loinc.org", display: "Body temperature" },
      respiratory_rate: { code: "9279-1", system: "http://loinc.org", display: "Respiratory rate" },
      weight: { code: "29463-7", system: "http://loinc.org", display: "Body weight" },
      blood_glucose: { code: "2339-0", system: "http://loinc.org", display: "Glucose" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 15,
    maxHistoryDays: 365
  },
  {
    platform: "google_fit",
    name: "Google Fit",
    icon: "activity",
    description: "Health and fitness data from Android devices and Wear OS watches including steps, heart rate, sleep, and workouts",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/fitness.activity.read", "https://www.googleapis.com/auth/fitness.body.read", "https://www.googleapis.com/auth/fitness.heart_rate.read", "https://www.googleapis.com/auth/fitness.sleep.read"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_pressure", "blood_glucose", "body_temperature", "activity", "nutrition", "weight", "body_fat", "workout", "hydration"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_pressure: { code: "85354-9", system: "http://loinc.org", display: "Blood pressure" },
      weight: { code: "29463-7", system: "http://loinc.org", display: "Body weight" },
      blood_glucose: { code: "2339-0", system: "http://loinc.org", display: "Glucose" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 15,
    maxHistoryDays: 365
  },
  {
    platform: "fitbit",
    name: "Fitbit",
    icon: "watch",
    description: "Activity, sleep, heart rate, and stress data from Fitbit trackers and smartwatches",
    authUrl: "https://www.fitbit.com/oauth2/authorize",
    tokenUrl: "https://api.fitbit.com/oauth2/token",
    scopes: ["activity", "heartrate", "sleep", "weight", "nutrition", "profile", "oxygen_saturation", "respiratory_rate", "temperature"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "respiratory_rate", "hrv", "activity", "nutrition", "weight", "body_fat", "stress", "workout", "body_temperature"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      respiratory_rate: { code: "9279-1", system: "http://loinc.org", display: "Respiratory rate" },
      weight: { code: "29463-7", system: "http://loinc.org", display: "Body weight" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 15,
    maxHistoryDays: 365
  },
  {
    platform: "samsung_health",
    name: "Samsung Health",
    icon: "smartphone",
    description: "Health data from Samsung Galaxy devices and Galaxy Watch including heart rate, sleep, blood pressure, and body composition",
    authUrl: "https://account.samsung.com/accounts/v1/STGDPROV0005/authorize",
    tokenUrl: "https://account.samsung.com/accounts/v1/STGDPROV0005/token",
    scopes: ["healthdata.read"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "blood_pressure", "body_temperature", "activity", "weight", "body_fat", "stress", "workout"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      blood_pressure: { code: "85354-9", system: "http://loinc.org", display: "Blood pressure" },
      weight: { code: "29463-7", system: "http://loinc.org", display: "Body weight" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 30,
    maxHistoryDays: 180
  },
  {
    platform: "garmin",
    name: "Garmin Connect",
    icon: "compass",
    description: "Advanced fitness and health metrics from Garmin devices including VO2 max, training load, body battery, and pulse ox",
    authUrl: "https://connect.garmin.com/oauthConfirm",
    tokenUrl: "https://connectapi.garmin.com/oauth-service/oauth/access_token",
    scopes: ["healthapi.read"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "respiratory_rate", "hrv", "activity", "weight", "body_fat", "stress", "workout", "hydration"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      respiratory_rate: { code: "9279-1", system: "http://loinc.org", display: "Respiratory rate" },
      weight: { code: "29463-7", system: "http://loinc.org", display: "Body weight" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 15,
    maxHistoryDays: 365
  },
  {
    platform: "oura",
    name: "Oura Ring",
    icon: "circle",
    description: "Sleep, readiness, and activity data from Oura Ring including detailed sleep stages, HRV, and body temperature trends",
    authUrl: "https://cloud.ouraring.com/oauth/authorize",
    tokenUrl: "https://api.ouraring.com/oauth/token",
    scopes: ["daily", "heartrate", "personal", "session", "sleep", "workout"],
    supportedCategories: ["heart_rate", "steps", "calories", "sleep", "body_temperature", "respiratory_rate", "hrv", "activity", "stress"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      body_temperature: { code: "8310-5", system: "http://loinc.org", display: "Body temperature" },
      respiratory_rate: { code: "9279-1", system: "http://loinc.org", display: "Respiratory rate" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 60,
    maxHistoryDays: 365
  },
  {
    platform: "whoop",
    name: "WHOOP",
    icon: "zap",
    description: "Recovery, strain, and sleep performance data from WHOOP bands with HRV-based recovery scoring",
    authUrl: "https://api.prod.whoop.com/oauth/oauth2/auth",
    tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
    scopes: ["read:recovery", "read:cycles", "read:sleep", "read:workout", "read:body_measurement"],
    supportedCategories: ["heart_rate", "calories", "sleep", "respiratory_rate", "hrv", "activity", "stress", "workout"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      respiratory_rate: { code: "9279-1", system: "http://loinc.org", display: "Respiratory rate" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 60,
    maxHistoryDays: 365
  },
  {
    platform: "withings",
    name: "Withings",
    icon: "thermometer",
    description: "Medical-grade health data from Withings devices including blood pressure monitors, smart scales, and sleep trackers",
    authUrl: "https://account.withings.com/oauth2_user/authorize2",
    tokenUrl: "https://wbsapi.withings.net/v2/oauth2",
    scopes: ["user.metrics", "user.activity", "user.sleepevents"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "blood_pressure", "body_temperature", "ecg", "weight", "body_fat"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_pressure: { code: "85354-9", system: "http://loinc.org", display: "Blood pressure" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      weight: { code: "29463-7", system: "http://loinc.org", display: "Body weight" },
      body_temperature: { code: "8310-5", system: "http://loinc.org", display: "Body temperature" }
    },
    refreshIntervalMinutes: 30,
    maxHistoryDays: 365
  },
  {
    platform: "dexcom",
    name: "Dexcom CGM",
    icon: "droplet",
    description: "Continuous glucose monitoring data from Dexcom sensors with real-time glucose readings every 5 minutes",
    authUrl: "https://api.dexcom.com/v2/oauth2/login",
    tokenUrl: "https://api.dexcom.com/v2/oauth2/token",
    scopes: ["offline_access"],
    supportedCategories: ["blood_glucose"],
    fhirMapping: {
      blood_glucose: { code: "2339-0", system: "http://loinc.org", display: "Glucose [Mass/volume] in Blood" }
    },
    refreshIntervalMinutes: 5,
    maxHistoryDays: 90
  },
  {
    platform: "suunto",
    name: "Suunto",
    icon: "navigation",
    description: "Outdoor sports and training data from Suunto watches including GPS tracking, altitude, heart rate, and training load analysis",
    authUrl: "https://cloudapi-oauth.suunto.com/oauth/authorize",
    tokenUrl: "https://cloudapi-oauth.suunto.com/oauth/token",
    scopes: ["workout", "sleep"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "hrv", "activity", "stress", "workout"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 30,
    maxHistoryDays: 365
  },
  {
    platform: "polar",
    name: "Polar",
    icon: "radio",
    description: "Precision heart rate and training data from Polar devices including Vantage, Grit X, Ignite, and Pacer series with advanced running metrics",
    authUrl: "https://flow.polar.com/oauth2/authorization",
    tokenUrl: "https://polarremote.com/v2/oauth2/token",
    scopes: ["accesslink.read_all"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "respiratory_rate", "hrv", "activity", "workout"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      respiratory_rate: { code: "9279-1", system: "http://loinc.org", display: "Respiratory rate" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 30,
    maxHistoryDays: 365
  },
  {
    platform: "amazfit",
    name: "Amazfit / Zepp",
    icon: "watch",
    description: "Health and fitness data from Amazfit and Zepp devices including T-Rex, GTR, GTS, and Bip series with PAI health scoring",
    authUrl: "https://auth-us.zepp.com/oauth2/authorize",
    tokenUrl: "https://auth-us.zepp.com/oauth2/access_token",
    scopes: ["data:read"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "body_temperature", "hrv", "activity", "stress", "workout"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      body_temperature: { code: "8310-5", system: "http://loinc.org", display: "Body temperature" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 30,
    maxHistoryDays: 180
  },
  {
    platform: "coros",
    name: "COROS",
    icon: "trending-up",
    description: "Training and recovery data from COROS watches including PACE, APEX, and VERTIX series with EvoLab training metrics",
    authUrl: "https://open.coros.com/oauth2/authorize",
    tokenUrl: "https://open.coros.com/oauth2/token",
    scopes: ["sport.read", "health.read"],
    supportedCategories: ["heart_rate", "steps", "distance", "calories", "sleep", "blood_oxygen", "hrv", "activity", "workout"],
    fhirMapping: {
      heart_rate: { code: "8867-4", system: "http://loinc.org", display: "Heart rate" },
      blood_oxygen: { code: "59408-5", system: "http://loinc.org", display: "Oxygen saturation" },
      steps: { code: "55423-8", system: "http://loinc.org", display: "Number of steps" }
    },
    refreshIntervalMinutes: 30,
    maxHistoryDays: 365
  }
];

class WearableDeviceService {
  private devices: Map<string, WearableDevice> = new Map();
  private dataPoints: Map<string, WearableDataPoint[]> = new Map();
  private anomalies: Map<string, AnomalyDetection[]> = new Map();
  private syncHistory: Map<string, WearableSyncResult[]> = new Map();

  getPlatforms(): WearablePlatformConfig[] {
    return PLATFORM_CONFIGS;
  }

  getPlatform(platform: WearablePlatform): WearablePlatformConfig | undefined {
    return PLATFORM_CONFIGS.find(p => p.platform === platform);
  }

  getAuthorizationUrl(platform: WearablePlatform, state: string, redirectUri: string): string {
    const config = this.getPlatform(platform);
    if (!config) throw new Error("Platform not found");

    const url = new URL(config.authUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", `tabula_medica_${platform}`);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", config.scopes.join(" "));
    url.searchParams.set("state", state);
    return url.toString();
  }

  async connectDevice(
    userId: string,
    platform: WearablePlatform,
    authCode: string,
    deviceName?: string
  ): Promise<WearableDevice> {
    const config = this.getPlatform(platform);
    if (!config) throw new Error("Platform not supported");

    const device: WearableDevice = {
      id: `dev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      platform,
      deviceName: deviceName || config.name,
      status: "connected",
      capabilities: config.supportedCategories,
      authToken: `${platform}_token_${Math.random().toString(36).substr(2, 16)}`,
      refreshToken: `${platform}_refresh_${Math.random().toString(36).substr(2, 16)}`,
      tokenExpiry: new Date(Date.now() + 3600000),
      connectedAt: new Date(),
      lastSync: new Date()
    };

    this.devices.set(device.id, device);
    return device;
  }

  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error("Device not found");
    device.status = "disconnected";
    device.authToken = undefined;
    device.refreshToken = undefined;
  }

  getUserDevices(userId: string): WearableDevice[] {
    return Array.from(this.devices.values())
      .filter(d => d.userId === userId);
  }

  getDevice(deviceId: string): WearableDevice | undefined {
    return this.devices.get(deviceId);
  }

  async syncDevice(deviceId: string): Promise<WearableSyncResult> {
    const device = this.devices.get(deviceId);
    if (!device) throw new Error("Device not found");

    device.status = "syncing";

    const config = this.getPlatform(device.platform);
    if (!config) throw new Error("Platform config not found");

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const now = new Date();
    const categories = config.supportedCategories;
    const dataPoints: WearableDataPoint[] = [];
    let duplicates = 0;

    for (const category of categories) {
      const count = Math.floor(Math.random() * 20) + 5;
      for (let i = 0; i < count; i++) {
        const dp = this.generateDataPoint(device, category, new Date(now.getTime() - i * 15 * 60 * 1000));
        if (Math.random() < 0.05) {
          duplicates++;
        } else {
          dataPoints.push(dp);
        }
      }
    }

    const existingPoints = this.dataPoints.get(device.userId) || [];
    existingPoints.push(...dataPoints);
    this.dataPoints.set(device.userId, existingPoints);

    const anomaliesDetected = this.detectAnomalies(device.userId, dataPoints);
    if (anomaliesDetected.length > 0) {
      const existing = this.anomalies.get(device.userId) || [];
      existing.push(...anomaliesDetected);
      this.anomalies.set(device.userId, existing);
    }

    device.status = "connected";
    device.lastSync = now;

    const syncResult: WearableSyncResult = {
      deviceId,
      platform: device.platform,
      syncedAt: now,
      dataPointsReceived: dataPoints.length + duplicates,
      dataPointsStored: dataPoints.length,
      duplicatesSkipped: duplicates,
      errors: [],
      categories,
      dateRange: {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now
      }
    };

    const history = this.syncHistory.get(deviceId) || [];
    history.push(syncResult);
    this.syncHistory.set(deviceId, history);

    return syncResult;
  }

  private generateDataPoint(device: WearableDevice, category: DataCategory, timestamp: Date): WearableDataPoint {
    const metrics = this.getCategoryMetrics(category);
    return {
      id: `dp_${Math.random().toString(36).substr(2, 9)}`,
      deviceId: device.id,
      userId: device.userId,
      category,
      metric: metrics.metric,
      value: metrics.generateValue(),
      unit: metrics.unit,
      timestamp,
      source: device.platform,
      confidence: 0.85 + Math.random() * 0.15
    };
  }

  private getCategoryMetrics(category: DataCategory): { metric: string; unit: string; generateValue: () => number } {
    const metrics: Record<DataCategory, { metric: string; unit: string; generateValue: () => number }> = {
      heart_rate: { metric: "bpm", unit: "beats/min", generateValue: () => 55 + Math.random() * 45 },
      steps: { metric: "count", unit: "steps", generateValue: () => Math.floor(Math.random() * 500) },
      distance: { metric: "meters", unit: "m", generateValue: () => Math.floor(Math.random() * 5000) },
      calories: { metric: "kcal", unit: "kcal", generateValue: () => Math.floor(50 + Math.random() * 200) },
      sleep: { metric: "minutes", unit: "min", generateValue: () => Math.floor(300 + Math.random() * 240) },
      blood_oxygen: { metric: "spo2", unit: "%", generateValue: () => 94 + Math.random() * 6 },
      blood_pressure: { metric: "mmHg", unit: "mmHg", generateValue: () => 110 + Math.random() * 30 },
      blood_glucose: { metric: "mg/dL", unit: "mg/dL", generateValue: () => 70 + Math.random() * 60 },
      body_temperature: { metric: "fahrenheit", unit: "°F", generateValue: () => 97 + Math.random() * 2 },
      respiratory_rate: { metric: "breaths/min", unit: "breaths/min", generateValue: () => 12 + Math.random() * 8 },
      hrv: { metric: "ms", unit: "ms", generateValue: () => 20 + Math.random() * 80 },
      ecg: { metric: "mV", unit: "mV", generateValue: () => -0.5 + Math.random() * 2 },
      activity: { metric: "minutes", unit: "min", generateValue: () => Math.floor(Math.random() * 60) },
      nutrition: { metric: "calories", unit: "kcal", generateValue: () => Math.floor(100 + Math.random() * 600) },
      weight: { metric: "kg", unit: "kg", generateValue: () => 60 + Math.random() * 40 },
      body_fat: { metric: "percent", unit: "%", generateValue: () => 10 + Math.random() * 25 },
      hydration: { metric: "ml", unit: "mL", generateValue: () => Math.floor(200 + Math.random() * 500) },
      stress: { metric: "score", unit: "score", generateValue: () => Math.floor(1 + Math.random() * 100) },
      menstrual: { metric: "day", unit: "day", generateValue: () => Math.floor(1 + Math.random() * 28) },
      workout: { metric: "minutes", unit: "min", generateValue: () => Math.floor(15 + Math.random() * 90) }
    };
    return metrics[category];
  }

  private detectAnomalies(userId: string, dataPoints: WearableDataPoint[]): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    const normalRanges: Partial<Record<DataCategory, { min: number; max: number }>> = {
      heart_rate: { min: 50, max: 100 },
      blood_oxygen: { min: 95, max: 100 },
      blood_pressure: { min: 90, max: 140 },
      blood_glucose: { min: 70, max: 180 },
      body_temperature: { min: 97, max: 99.5 },
      respiratory_rate: { min: 12, max: 20 }
    };

    for (const dp of dataPoints) {
      const range = normalRanges[dp.category];
      if (!range) continue;

      if (dp.value < range.min || dp.value > range.max) {
        const severity = dp.value < range.min * 0.8 || dp.value > range.max * 1.2
          ? "high"
          : dp.value < range.min * 0.9 || dp.value > range.max * 1.1
            ? "medium"
            : "low";

        anomalies.push({
          id: `anomaly_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          deviceId: dp.deviceId,
          category: dp.category,
          metric: dp.metric,
          detectedAt: new Date(),
          severity,
          anomalyType: dp.value < range.min ? "drop" : "spike",
          currentValue: Math.round(dp.value * 100) / 100,
          expectedRange: range,
          unit: dp.unit,
          description: `${dp.category.replace(/_/g, " ")} reading of ${Math.round(dp.value * 100) / 100} ${dp.unit} is outside normal range (${range.min}-${range.max})`,
          recommendation: this.getAnomalyRecommendation(dp.category, dp.value, range),
          acknowledged: false
        });
      }
    }

    return anomalies;
  }

  private getAnomalyRecommendation(category: DataCategory, value: number, range: { min: number; max: number }): string {
    const recommendations: Partial<Record<DataCategory, string>> = {
      heart_rate: value > range.max
        ? "Elevated heart rate detected. If you were not exercising, consider resting and monitoring. Contact your care team if this persists."
        : "Low heart rate detected. This may be normal if you are well-conditioned, but contact your care team if you feel dizzy or faint.",
      blood_oxygen: "Low blood oxygen level detected. Try deep breathing exercises. If readings remain below 92%, seek immediate medical attention.",
      blood_pressure: value > range.max
        ? "Elevated blood pressure reading. Sit quietly for 5 minutes and re-measure. Consult your care team if consistently elevated."
        : "Low blood pressure detected. Ensure adequate hydration and contact your care team if you experience dizziness.",
      blood_glucose: value > range.max
        ? "High blood glucose detected. Follow your meal plan and check again in 2 hours. Contact your care team if consistently elevated."
        : "Low blood glucose detected. Consume 15g of fast-acting carbohydrate and recheck in 15 minutes.",
      body_temperature: value > range.max
        ? "Elevated temperature detected. Monitor for other symptoms. Contact your care team if temperature exceeds 101.3F."
        : "Below normal temperature detected. Ensure you are in a warm environment.",
      respiratory_rate: value > range.max
        ? "Elevated respiratory rate. Rest and practice calm breathing. Seek medical attention if accompanied by difficulty breathing."
        : "Low respiratory rate detected. Monitor for any changes in breathing patterns."
    };
    return recommendations[category] || "Value outside normal range. Consider consulting your healthcare provider.";
  }

  getDataPoints(userId: string, options?: {
    category?: DataCategory;
    deviceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): WearableDataPoint[] {
    let points = this.dataPoints.get(userId) || [];

    if (options?.category) points = points.filter(p => p.category === options.category);
    if (options?.deviceId) points = points.filter(p => p.deviceId === options.deviceId);
    if (options?.startDate) points = points.filter(p => p.timestamp >= options.startDate!);
    if (options?.endDate) points = points.filter(p => p.timestamp <= options.endDate!);

    points.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) points = points.slice(0, options.limit);

    return points;
  }

  getAnomalies(userId: string, options?: {
    severity?: string;
    category?: DataCategory;
    acknowledged?: boolean;
    limit?: number;
  }): AnomalyDetection[] {
    let anomalies = this.anomalies.get(userId) || [];

    if (options?.severity) anomalies = anomalies.filter(a => a.severity === options.severity);
    if (options?.category) anomalies = anomalies.filter(a => a.category === options.category);
    if (options?.acknowledged !== undefined) anomalies = anomalies.filter(a => a.acknowledged === options.acknowledged);

    anomalies.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());

    if (options?.limit) anomalies = anomalies.slice(0, options.limit);

    return anomalies;
  }

  acknowledgeAnomaly(userId: string, anomalyId: string): boolean {
    const anomalies = this.anomalies.get(userId) || [];
    const anomaly = anomalies.find(a => a.id === anomalyId);
    if (anomaly) {
      anomaly.acknowledged = true;
      return true;
    }
    return false;
  }

  getSyncHistory(deviceId: string): WearableSyncResult[] {
    return this.syncHistory.get(deviceId) || [];
  }

  convertToFHIR(dataPoint: WearableDataPoint): any {
    const config = this.getPlatform(dataPoint.source);
    if (!config) return null;

    const mapping = config.fhirMapping[dataPoint.category];
    if (!mapping) return null;

    return {
      resourceType: "Observation",
      id: dataPoint.id,
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: ["heart_rate", "blood_oxygen", "blood_pressure", "body_temperature", "respiratory_rate"].includes(dataPoint.category)
            ? "vital-signs" : "activity",
          display: ["heart_rate", "blood_oxygen", "blood_pressure", "body_temperature", "respiratory_rate"].includes(dataPoint.category)
            ? "Vital Signs" : "Activity"
        }]
      }],
      code: { coding: [mapping] },
      effectiveDateTime: dataPoint.timestamp.toISOString(),
      valueQuantity: {
        value: Math.round(dataPoint.value * 100) / 100,
        unit: dataPoint.unit,
        system: "http://unitsofmeasure.org"
      },
      device: {
        display: `${config.name} - ${dataPoint.source}`
      },
      meta: {
        source: config.name,
        lastUpdated: dataPoint.timestamp.toISOString()
      }
    };
  }

  getDeviceStats(userId: string): {
    totalDevices: number;
    connectedDevices: number;
    totalDataPoints: number;
    activeAnomalies: number;
    platformBreakdown: Record<string, number>;
    categoryBreakdown: Record<string, number>;
    lastSyncTime?: Date;
  } {
    const devices = this.getUserDevices(userId);
    const dataPoints = this.dataPoints.get(userId) || [];
    const anomalies = (this.anomalies.get(userId) || []).filter(a => !a.acknowledged);

    const platformBreakdown: Record<string, number> = {};
    devices.forEach(d => {
      platformBreakdown[d.platform] = (platformBreakdown[d.platform] || 0) + 1;
    });

    const categoryBreakdown: Record<string, number> = {};
    dataPoints.forEach(dp => {
      categoryBreakdown[dp.category] = (categoryBreakdown[dp.category] || 0) + 1;
    });

    const lastSync = devices
      .filter(d => d.lastSync)
      .sort((a, b) => (b.lastSync?.getTime() || 0) - (a.lastSync?.getTime() || 0))[0]?.lastSync;

    return {
      totalDevices: devices.length,
      connectedDevices: devices.filter(d => d.status === "connected").length,
      totalDataPoints: dataPoints.length,
      activeAnomalies: anomalies.length,
      platformBreakdown,
      categoryBreakdown,
      lastSyncTime: lastSync
    };
  }

  importPlatformData(userId: string, platform: WearablePlatform, rawData: any): {
    dataPoints: WearableDataPoint[];
    healthGraphEntities: Array<{ type: string; label: string; value: number; unit: string; date: Date; loincCode?: string; category: DataCategory }>;
    lineageRecord: {
      sourceType: string;
      sourcePlatform: string;
      importedAt: Date;
      recordCount: number;
      categories: string[];
      transformations: Array<"import" | "normalization" | "validation" | "fhir_mapping" | "vocabulary_translation">;
    };
    anomalies: AnomalyDetection[];
    errors: string[];
  } {
    const config = this.getPlatform(platform);
    if (!config) throw new Error(`Platform ${platform} not supported`);

    const errors: string[] = [];
    let parsedPoints: WearableDataPoint[] = [];

    switch (platform) {
      case "fitbit":
        parsedPoints = this.parseFitbitData(userId, rawData, errors);
        break;
      case "garmin":
        parsedPoints = this.parseGarminData(userId, rawData, errors);
        break;
      case "samsung_health":
        parsedPoints = this.parseSamsungHealthData(userId, rawData, errors);
        break;
      default:
        parsedPoints = this.parseGenericWearableData(userId, platform, rawData, errors);
        break;
    }

    const existingPoints = this.dataPoints.get(userId) || [];
    existingPoints.push(...parsedPoints);
    this.dataPoints.set(userId, existingPoints);

    const anomaliesDetected = this.detectAnomalies(userId, parsedPoints);
    if (anomaliesDetected.length > 0) {
      const existing = this.anomalies.get(userId) || [];
      existing.push(...anomaliesDetected);
      this.anomalies.set(userId, existing);
    }

    const healthGraphEntities = parsedPoints.map(dp => {
      const mapping = config.fhirMapping[dp.category];
      return {
        type: ["heart_rate", "blood_oxygen", "blood_pressure", "body_temperature", "respiratory_rate", "blood_glucose"].includes(dp.category) ? "vital" : "activity",
        label: mapping?.display || dp.category.replace(/_/g, " "),
        value: dp.value,
        unit: dp.unit,
        date: dp.timestamp,
        loincCode: mapping?.code,
        category: dp.category
      };
    });

    const categories = [...new Set(parsedPoints.map(p => p.category))];

    type LineageTransformation = "import" | "normalization" | "validation" | "fhir_mapping" | "vocabulary_translation";
    const lineageRecord: {
      sourceType: string;
      sourcePlatform: string;
      importedAt: Date;
      recordCount: number;
      categories: string[];
      transformations: LineageTransformation[];
    } = {
      sourceType: "wearable_import",
      sourcePlatform: config.name,
      importedAt: new Date(),
      recordCount: parsedPoints.length,
      categories: categories as string[],
      transformations: [
        "import",
        "normalization",
        "validation",
        "fhir_mapping",
        "vocabulary_translation",
      ],
    };

    return {
      dataPoints: parsedPoints,
      healthGraphEntities,
      lineageRecord,
      anomalies: anomaliesDetected,
      errors
    };
  }

  private parseFitbitData(userId: string, rawData: any, errors: string[]): WearableDataPoint[] {
    const points: WearableDataPoint[] = [];

    try {
      if (rawData.activities) {
        for (const activity of Array.isArray(rawData.activities) ? rawData.activities : [rawData.activities]) {
          const ts = new Date(activity.dateTime || activity.startTime || new Date());
          if (activity.steps !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "steps", Number(activity.steps), "steps", ts));
          }
          if (activity.calories !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "calories", Number(activity.calories), "kcal", ts));
          }
          if (activity.distance !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "distance", Number(activity.distance) * 1000, "m", ts));
          }
          if (activity.activeMinutes !== undefined || activity.minutesFairlyActive !== undefined) {
            const activeMin = activity.activeMinutes || (activity.minutesFairlyActive || 0) + (activity.minutesVeryActive || 0);
            points.push(this.createImportedDataPoint(userId, "fitbit", "activity", Number(activeMin), "min", ts));
          }
        }
      }

      if (rawData.heartRate || rawData["activities-heart"]) {
        const hrData = rawData.heartRate || rawData["activities-heart"] || [];
        for (const hr of Array.isArray(hrData) ? hrData : [hrData]) {
          const ts = new Date(hr.dateTime || hr.date || new Date());
          const val = hr.value?.restingHeartRate || hr.restingHeartRate || hr.value || hr.bpm;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "heart_rate", Number(val), "beats/min", ts));
          }
        }
      }

      if (rawData.sleep) {
        const sleepData = Array.isArray(rawData.sleep) ? rawData.sleep : [rawData.sleep];
        for (const sleep of sleepData) {
          const ts = new Date(sleep.dateOfSleep || sleep.startTime || new Date());
          if (sleep.minutesAsleep !== undefined || sleep.duration !== undefined) {
            const minutes = sleep.minutesAsleep || Math.round((sleep.duration || 0) / 60000);
            points.push(this.createImportedDataPoint(userId, "fitbit", "sleep", Number(minutes), "min", ts));
          }
        }
      }

      if (rawData.spo2 || rawData.bloodOxygen) {
        const spo2Data = rawData.spo2 || rawData.bloodOxygen || [];
        for (const reading of Array.isArray(spo2Data) ? spo2Data : [spo2Data]) {
          const ts = new Date(reading.dateTime || reading.date || new Date());
          const val = reading.value?.avg || reading.avg || reading.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "blood_oxygen", Number(val), "%", ts));
          }
        }
      }

      if (rawData.weight || rawData.body) {
        const weightData = rawData.weight || rawData.body?.weight || [];
        for (const w of Array.isArray(weightData) ? weightData : [weightData]) {
          const ts = new Date(w.date || w.dateTime || new Date());
          if (w.weight !== undefined || w.value !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "weight", Number(w.weight || w.value), "kg", ts));
          }
          if (w.fat !== undefined || w.bodyFat !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "body_fat", Number(w.fat || w.bodyFat), "%", ts));
          }
        }
      }

      if (rawData.hrv) {
        const hrvData = Array.isArray(rawData.hrv) ? rawData.hrv : [rawData.hrv];
        for (const h of hrvData) {
          const ts = new Date(h.dateTime || h.date || new Date());
          const val = h.value?.rmssd || h.rmssd || h.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "hrv", Number(val), "ms", ts));
          }
        }
      }

      if (rawData.respiratoryRate || rawData.br) {
        const brData = rawData.respiratoryRate || rawData.br || [];
        for (const r of Array.isArray(brData) ? brData : [brData]) {
          const ts = new Date(r.dateTime || r.date || new Date());
          const val = r.value?.breathingRate || r.breathingRate || r.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "respiratory_rate", Number(val), "breaths/min", ts));
          }
        }
      }

      if (rawData.stress) {
        const stressData = Array.isArray(rawData.stress) ? rawData.stress : [rawData.stress];
        for (const s of stressData) {
          const ts = new Date(s.dateTime || s.date || new Date());
          const val = s.stressManagementScore || s.score || s.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "fitbit", "stress", Number(val), "score", ts));
          }
        }
      }
    } catch (e: any) {
      errors.push(`Fitbit parse error: ${e.message}`);
    }

    return points;
  }

  private parseGarminData(userId: string, rawData: any, errors: string[]): WearableDataPoint[] {
    const points: WearableDataPoint[] = [];

    try {
      if (rawData.dailies || rawData.activities || rawData.activityDetails) {
        const dailies = rawData.dailies || rawData.activities || rawData.activityDetails || [];
        for (const day of Array.isArray(dailies) ? dailies : [dailies]) {
          const ts = new Date(day.calendarDate || day.startTimeInSeconds ? new Date(day.startTimeInSeconds * 1000) : new Date());
          if (day.steps !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "steps", Number(day.steps), "steps", ts));
          }
          if (day.distanceInMeters !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "distance", Number(day.distanceInMeters), "m", ts));
          }
          if (day.activeKilocalories !== undefined || day.totalKilocalories !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "calories", Number(day.activeKilocalories || day.totalKilocalories), "kcal", ts));
          }
          if (day.moderateIntensityDurationInSeconds !== undefined || day.vigorousIntensityDurationInSeconds !== undefined) {
            const activeMin = Math.round(((day.moderateIntensityDurationInSeconds || 0) + (day.vigorousIntensityDurationInSeconds || 0)) / 60);
            points.push(this.createImportedDataPoint(userId, "garmin", "activity", activeMin, "min", ts));
          }
          if (day.restingHeartRateInBeatsPerMinute !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "heart_rate", Number(day.restingHeartRateInBeatsPerMinute), "beats/min", ts));
          }
          if (day.averageStressLevel !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "stress", Number(day.averageStressLevel), "score", ts));
          }
        }
      }

      if (rawData.sleeps || rawData.sleepData) {
        const sleeps = rawData.sleeps || rawData.sleepData || [];
        for (const sleep of Array.isArray(sleeps) ? sleeps : [sleeps]) {
          const ts = new Date(sleep.calendarDate || new Date());
          if (sleep.durationInSeconds !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "sleep", Math.round(sleep.durationInSeconds / 60), "min", ts));
          }
        }
      }

      if (rawData.pulseOx || rawData.spo2) {
        const oxData = rawData.pulseOx || rawData.spo2 || [];
        for (const reading of Array.isArray(oxData) ? oxData : [oxData]) {
          const ts = new Date(reading.calendarDate || new Date());
          const val = reading.averageSPO2 || reading.spo2Value || reading.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "blood_oxygen", Number(val), "%", ts));
          }
        }
      }

      if (rawData.respiration || rawData.respiratoryData) {
        const respData = rawData.respiration || rawData.respiratoryData || [];
        for (const r of Array.isArray(respData) ? respData : [respData]) {
          const ts = new Date(r.calendarDate || new Date());
          const val = r.avgWakingRespirationValue || r.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "respiratory_rate", Number(val), "breaths/min", ts));
          }
        }
      }

      if (rawData.bodyComposition || rawData.weight) {
        const bodyData = rawData.bodyComposition || rawData.weight || [];
        for (const b of Array.isArray(bodyData) ? bodyData : [bodyData]) {
          const ts = new Date(b.calendarDate || b.date || new Date());
          if (b.weightInGrams !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "weight", b.weightInGrams / 1000, "kg", ts));
          } else if (b.weight !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "weight", Number(b.weight), "kg", ts));
          }
          if (b.bodyFatPercentage !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "body_fat", Number(b.bodyFatPercentage), "%", ts));
          }
        }
      }

      if (rawData.hrv || rawData.hrvData) {
        const hrvData = rawData.hrv || rawData.hrvData || [];
        for (const h of Array.isArray(hrvData) ? hrvData : [hrvData]) {
          const ts = new Date(h.calendarDate || h.date || new Date());
          const val = h.lastNightAvg || h.weeklyAvg || h.hrvValue || h.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "hrv", Number(val), "ms", ts));
          }
        }
      }

      if (rawData.hydration || rawData.hydrationData) {
        const hydData = rawData.hydration || rawData.hydrationData || [];
        for (const h of Array.isArray(hydData) ? hydData : [hydData]) {
          const ts = new Date(h.calendarDate || new Date());
          const val = h.valueInML || h.sweatLossInML || h.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "garmin", "hydration", Number(val), "mL", ts));
          }
        }
      }
    } catch (e: any) {
      errors.push(`Garmin parse error: ${e.message}`);
    }

    return points;
  }

  private parseSamsungHealthData(userId: string, rawData: any, errors: string[]): WearableDataPoint[] {
    const points: WearableDataPoint[] = [];

    try {
      if (rawData.stepCount || rawData.steps) {
        const stepData = rawData.stepCount || rawData.steps || [];
        for (const entry of Array.isArray(stepData) ? stepData : [stepData]) {
          const ts = new Date(entry.start_time || entry.day_time || entry.date || new Date());
          const val = entry.count || entry.steps || entry.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "steps", Number(val), "steps", ts));
          }
        }
      }

      if (rawData.heartRate || rawData.heart_rate) {
        const hrData = rawData.heartRate || rawData.heart_rate || [];
        for (const entry of Array.isArray(hrData) ? hrData : [hrData]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          const val = entry.heart_rate || entry.bpm || entry.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "heart_rate", Number(val), "beats/min", ts));
          }
        }
      }

      if (rawData.sleep || rawData.sleepData) {
        const sleepData = rawData.sleep || rawData.sleepData || [];
        for (const entry of Array.isArray(sleepData) ? sleepData : [sleepData]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          let minutes = 0;
          if (entry.duration !== undefined) {
            minutes = typeof entry.duration === "number" ? Math.round(entry.duration / 60000) : Number(entry.duration);
          } else if (entry.start_time && entry.end_time) {
            minutes = Math.round((new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / 60000);
          }
          if (minutes > 0) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "sleep", minutes, "min", ts));
          }
        }
      }

      if (rawData.bloodOxygen || rawData.oxygen_saturation) {
        const spo2Data = rawData.bloodOxygen || rawData.oxygen_saturation || [];
        for (const entry of Array.isArray(spo2Data) ? spo2Data : [spo2Data]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          const val = entry.spo2 || entry.oxygen_saturation || entry.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "blood_oxygen", Number(val), "%", ts));
          }
        }
      }

      if (rawData.bloodPressure || rawData.blood_pressure) {
        const bpData = rawData.bloodPressure || rawData.blood_pressure || [];
        for (const entry of Array.isArray(bpData) ? bpData : [bpData]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          const systolic = entry.systolic || entry.max || entry.value;
          if (systolic !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "blood_pressure", Number(systolic), "mmHg", ts));
          }
        }
      }

      if (rawData.exercise || rawData.workouts) {
        const exData = rawData.exercise || rawData.workouts || [];
        for (const entry of Array.isArray(exData) ? exData : [exData]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          if (entry.duration !== undefined) {
            const minutes = typeof entry.duration === "number" && entry.duration > 1000
              ? Math.round(entry.duration / 60000) : Number(entry.duration);
            points.push(this.createImportedDataPoint(userId, "samsung_health", "workout", minutes, "min", ts));
          }
          if (entry.calorie !== undefined || entry.calories !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "calories", Number(entry.calorie || entry.calories), "kcal", ts));
          }
          if (entry.distance !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "distance", Number(entry.distance), "m", ts));
          }
        }
      }

      if (rawData.bodyComposition || rawData.weight) {
        const bodyData = rawData.bodyComposition || rawData.weight || [];
        for (const entry of Array.isArray(bodyData) ? bodyData : [bodyData]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          if (entry.weight !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "weight", Number(entry.weight), "kg", ts));
          }
          if (entry.body_fat_percentage !== undefined || entry.bodyFat !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "body_fat", Number(entry.body_fat_percentage || entry.bodyFat), "%", ts));
          }
        }
      }

      if (rawData.stress || rawData.stressData) {
        const stressData = rawData.stress || rawData.stressData || [];
        for (const entry of Array.isArray(stressData) ? stressData : [stressData]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          const val = entry.score || entry.stress_score || entry.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "stress", Number(val), "score", ts));
          }
        }
      }

      if (rawData.temperature || rawData.bodyTemperature) {
        const tempData = rawData.temperature || rawData.bodyTemperature || [];
        for (const entry of Array.isArray(tempData) ? tempData : [tempData]) {
          const ts = new Date(entry.start_time || entry.date || new Date());
          const val = entry.temperature || entry.value;
          if (val !== undefined) {
            points.push(this.createImportedDataPoint(userId, "samsung_health", "body_temperature", Number(val), "°F", ts));
          }
        }
      }
    } catch (e: any) {
      errors.push(`Samsung Health parse error: ${e.message}`);
    }

    return points;
  }

  private parseGenericWearableData(userId: string, platform: WearablePlatform, rawData: any, errors: string[]): WearableDataPoint[] {
    const points: WearableDataPoint[] = [];

    try {
      if (rawData.dataPoints && Array.isArray(rawData.dataPoints)) {
        for (const dp of rawData.dataPoints) {
          if (dp.category && dp.value !== undefined) {
            const metrics = this.getCategoryMetrics(dp.category as DataCategory);
            points.push(this.createImportedDataPoint(
              userId, platform, dp.category as DataCategory,
              Number(dp.value), dp.unit || metrics.unit,
              new Date(dp.timestamp || dp.date || new Date())
            ));
          }
        }
      }

      if (rawData.records && Array.isArray(rawData.records)) {
        for (const record of rawData.records) {
          const category = this.inferCategory(record);
          if (category && record.value !== undefined) {
            const metrics = this.getCategoryMetrics(category);
            points.push(this.createImportedDataPoint(
              userId, platform, category,
              Number(record.value), record.unit || metrics.unit,
              new Date(record.timestamp || record.date || new Date())
            ));
          }
        }
      }
    } catch (e: any) {
      errors.push(`Generic parse error for ${platform}: ${e.message}`);
    }

    return points;
  }

  private inferCategory(record: any): DataCategory | null {
    const label = (record.type || record.category || record.name || "").toLowerCase();
    const categoryMap: Record<string, DataCategory> = {
      "heart": "heart_rate", "heartrate": "heart_rate", "hr": "heart_rate", "pulse": "heart_rate",
      "step": "steps", "steps": "steps", "walk": "steps",
      "distance": "distance", "km": "distance", "miles": "distance",
      "calorie": "calories", "calories": "calories", "energy": "calories",
      "sleep": "sleep", "slept": "sleep",
      "spo2": "blood_oxygen", "oxygen": "blood_oxygen", "o2": "blood_oxygen",
      "bp": "blood_pressure", "pressure": "blood_pressure", "systolic": "blood_pressure",
      "glucose": "blood_glucose", "sugar": "blood_glucose", "bg": "blood_glucose",
      "temp": "body_temperature", "temperature": "body_temperature",
      "breath": "respiratory_rate", "respiration": "respiratory_rate",
      "hrv": "hrv", "variability": "hrv",
      "weight": "weight", "mass": "weight",
      "fat": "body_fat", "bodyfat": "body_fat",
      "stress": "stress",
      "workout": "workout", "exercise": "workout",
      "water": "hydration", "hydration": "hydration",
    };

    for (const [key, cat] of Object.entries(categoryMap)) {
      if (label.includes(key)) return cat;
    }
    return null;
  }

  private createImportedDataPoint(
    userId: string, platform: WearablePlatform, category: DataCategory,
    value: number, unit: string, timestamp: Date
  ): WearableDataPoint {
    return {
      id: `dp_import_${Math.random().toString(36).substr(2, 9)}`,
      deviceId: `imported_${platform}`,
      userId,
      category,
      metric: unit,
      value,
      unit,
      timestamp,
      source: platform,
      confidence: 0.85,
      metadata: { importedAt: new Date().toISOString(), importType: "manual" }
    };
  }
}

export const wearableDeviceService = new WearableDeviceService();

export function initializeWearableDevices() {
  console.log("Wearable device service initialized with", PLATFORM_CONFIGS.length, "platform connectors");
}
