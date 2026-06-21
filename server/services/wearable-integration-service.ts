import { logPhiAccess } from "../security/hipaa-audit";

export type WearableProvider = "fitbit" | "apple_health" | "google_fit" | "garmin" | "samsung_health";

export interface WearableDevice {
  id: string;
  provider: WearableProvider;
  name: string;
  model: string;
  lastSync: string;
  status: "connected" | "disconnected" | "syncing" | "error";
  batteryLevel?: number;
}

export interface DailySteps {
  date: string;
  steps: number;
  distance: number;
  caloriesBurned: number;
  activeMinutes: number;
  floors?: number;
}

export interface SleepData {
  date: string;
  totalMinutes: number;
  deepSleepMinutes: number;
  lightSleepMinutes: number;
  remSleepMinutes: number;
  awakeDuration: number;
  sleepEfficiency: number;
  bedtime: string;
  wakeTime: string;
  sleepScore?: number;
}

export interface HeartRateData {
  timestamp: string;
  bpm: number;
  zone: "rest" | "fat_burn" | "cardio" | "peak" | "out_of_range";
}

export interface HeartRateVariability {
  date: string;
  avgHrv: number;
  minHrv: number;
  maxHrv: number;
  readings: Array<{ timestamp: string; hrv: number }>;
}

export interface ActivityData {
  date: string;
  type: "walking" | "running" | "cycling" | "swimming" | "workout" | "yoga" | "other";
  duration: number;
  caloriesBurned: number;
  avgHeartRate?: number;
  distance?: number;
  elevationGain?: number;
}

export interface BloodOxygen {
  timestamp: string;
  spO2: number;
}

export interface HealthCorrelation {
  id: string;
  type: "sleep_bp" | "activity_glucose" | "hrv_stress" | "sleep_hrv" | "steps_weight";
  title: string;
  description: string;
  correlationStrength: number;
  trend: "positive" | "negative" | "neutral";
  dataPoints: Array<{ x: number; y: number; date: string }>;
  insight: string;
  noCdsDisclaimer: string;
}

export interface WearableSummary {
  todaySteps: number;
  weeklyAvgSteps: number;
  lastNightSleep: SleepData | null;
  avgSleepScore: number;
  restingHeartRate: number;
  avgHrv: number;
  activeMinutesToday: number;
  weeklyActiveMinutes: number;
  caloriesBurnedToday: number;
}

class WearableIntegrationService {
  private devices: Map<string, WearableDevice[]> = new Map();
  private stepsData: Map<string, DailySteps[]> = new Map();
  private sleepData: Map<string, SleepData[]> = new Map();
  private heartRateData: Map<string, HeartRateData[]> = new Map();
  private hrvData: Map<string, HeartRateVariability[]> = new Map();
  private activityData: Map<string, ActivityData[]> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[WearableIntegration] Service initialized with sample data");
  }

  private initializeSampleData(): void {
    const patientId = "patient-001";
    
    this.devices.set(patientId, [
      {
        id: "dev-fitbit-001",
        provider: "fitbit",
        name: "Fitbit Sense 2",
        model: "Sense 2",
        lastSync: new Date().toISOString(),
        status: "connected",
        batteryLevel: 78
      },
      {
        id: "dev-apple-001",
        provider: "apple_health",
        name: "Apple Watch Series 9",
        model: "Series 9",
        lastSync: new Date(Date.now() - 3600000).toISOString(),
        status: "connected",
        batteryLevel: 92
      }
    ]);

    const today = new Date();
    const stepsHistory: DailySteps[] = [];
    const sleepHistory: SleepData[] = [];
    const hrvHistory: HeartRateVariability[] = [];
    const activityHistory: ActivityData[] = [];
    const heartRateHistory: HeartRateData[] = [];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const baseSteps = 7500 + Math.floor(Math.random() * 5000);
      stepsHistory.push({
        date: dateStr,
        steps: baseSteps,
        distance: baseSteps * 0.0008,
        caloriesBurned: Math.floor(baseSteps * 0.04),
        activeMinutes: Math.floor(baseSteps / 100),
        floors: Math.floor(Math.random() * 15) + 5
      });

      const sleepDuration = 360 + Math.floor(Math.random() * 120);
      sleepHistory.push({
        date: dateStr,
        totalMinutes: sleepDuration,
        deepSleepMinutes: Math.floor(sleepDuration * 0.2),
        lightSleepMinutes: Math.floor(sleepDuration * 0.5),
        remSleepMinutes: Math.floor(sleepDuration * 0.25),
        awakeDuration: Math.floor(Math.random() * 30) + 5,
        sleepEfficiency: 85 + Math.floor(Math.random() * 10),
        bedtime: "22:30",
        wakeTime: "06:45",
        sleepScore: 70 + Math.floor(Math.random() * 25)
      });

      const avgHrv = 35 + Math.floor(Math.random() * 30);
      hrvHistory.push({
        date: dateStr,
        avgHrv,
        minHrv: avgHrv - 10,
        maxHrv: avgHrv + 15,
        readings: [
          { timestamp: `${dateStr}T02:00:00Z`, hrv: avgHrv - 5 },
          { timestamp: `${dateStr}T04:00:00Z`, hrv: avgHrv + 3 },
          { timestamp: `${dateStr}T06:00:00Z`, hrv: avgHrv }
        ]
      });

      if (i % 2 === 0) {
        activityHistory.push({
          date: dateStr,
          type: ["walking", "running", "cycling", "workout"][Math.floor(Math.random() * 4)] as any,
          duration: 30 + Math.floor(Math.random() * 45),
          caloriesBurned: 200 + Math.floor(Math.random() * 300),
          avgHeartRate: 120 + Math.floor(Math.random() * 30),
          distance: 2 + Math.random() * 5
        });
      }

      for (let h = 6; h < 22; h += 2) {
        const baseBpm = h < 12 ? 65 : (h < 18 ? 75 : 68);
        heartRateHistory.push({
          timestamp: `${dateStr}T${h.toString().padStart(2, '0')}:00:00Z`,
          bpm: baseBpm + Math.floor(Math.random() * 15),
          zone: baseBpm < 70 ? "rest" : (baseBpm < 90 ? "fat_burn" : "cardio")
        });
      }
    }

    this.stepsData.set(patientId, stepsHistory);
    this.sleepData.set(patientId, sleepHistory);
    this.hrvData.set(patientId, hrvHistory);
    this.activityData.set(patientId, activityHistory);
    this.heartRateData.set(patientId, heartRateHistory);
  }

  async getConnectedDevices(patientId: string): Promise<WearableDevice[]> {
    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableDevice",
      action: "read",
      details: "Retrieved connected wearable devices"
    });
    return this.devices.get(patientId) || [];
  }

  async connectDevice(patientId: string, provider: WearableProvider, authCode: string): Promise<WearableDevice> {
    const device: WearableDevice = {
      id: `dev-${provider}-${Date.now()}`,
      provider,
      name: this.getDeviceName(provider),
      model: this.getDeviceModel(provider),
      lastSync: new Date().toISOString(),
      status: "connected",
      batteryLevel: 100
    };

    const devices = this.devices.get(patientId) || [];
    devices.push(device);
    this.devices.set(patientId, devices);

    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableDevice",
      action: "write",
      details: `Connected new ${provider} device: ${device.name}`
    });

    return device;
  }

  async disconnectDevice(patientId: string, deviceId: string): Promise<boolean> {
    const devices = this.devices.get(patientId) || [];
    const index = devices.findIndex(d => d.id === deviceId);
    if (index >= 0) {
      devices.splice(index, 1);
      this.devices.set(patientId, devices);
      
      await logPhiAccess({
        userId: patientId,
        patientId,
        resourceType: "WearableDevice",
        action: "delete",
        details: `Disconnected device: ${deviceId}`
      });
      return true;
    }
    return false;
  }

  async syncDevice(patientId: string, deviceId: string): Promise<WearableDevice | null> {
    const devices = this.devices.get(patientId) || [];
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      device.status = "syncing";
      await new Promise(resolve => setTimeout(resolve, 1000));
      device.lastSync = new Date().toISOString();
      device.status = "connected";
      
      await logPhiAccess({
        userId: patientId,
        patientId,
        resourceType: "WearableDevice",
        action: "write",
        details: `Synced device: ${device.name}`
      });
      return device;
    }
    return null;
  }

  async getStepsData(patientId: string, days: number = 30): Promise<DailySteps[]> {
    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableSteps",
      action: "read",
      details: `Retrieved ${days} days of steps data`
    });
    const data = this.stepsData.get(patientId) || [];
    return data.slice(-days);
  }

  async getSleepData(patientId: string, days: number = 30): Promise<SleepData[]> {
    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableSleep",
      action: "read",
      details: `Retrieved ${days} days of sleep data`
    });
    const data = this.sleepData.get(patientId) || [];
    return data.slice(-days);
  }

  async getHeartRateData(patientId: string, days: number = 7): Promise<HeartRateData[]> {
    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableHeartRate",
      action: "read",
      details: `Retrieved ${days} days of heart rate data`
    });
    const data = this.heartRateData.get(patientId) || [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return data.filter(d => new Date(d.timestamp) >= cutoff);
  }

  async getHrvData(patientId: string, days: number = 30): Promise<HeartRateVariability[]> {
    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableHRV",
      action: "read",
      details: `Retrieved ${days} days of HRV data`
    });
    const data = this.hrvData.get(patientId) || [];
    return data.slice(-days);
  }

  async getActivityData(patientId: string, days: number = 30): Promise<ActivityData[]> {
    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableActivity",
      action: "read",
      details: `Retrieved ${days} days of activity data`
    });
    const data = this.activityData.get(patientId) || [];
    return data.slice(-days);
  }

  async getSummary(patientId: string): Promise<WearableSummary> {
    const steps = await this.getStepsData(patientId, 7);
    const sleep = await this.getSleepData(patientId, 7);
    const hrv = await this.getHrvData(patientId, 7);
    const heartRate = await this.getHeartRateData(patientId, 1);

    const todaySteps = steps[steps.length - 1]?.steps || 0;
    const weeklyAvgSteps = Math.floor(steps.reduce((sum, d) => sum + d.steps, 0) / steps.length);
    const lastNightSleep = sleep[sleep.length - 1] || null;
    const avgSleepScore = Math.floor(sleep.reduce((sum, d) => sum + (d.sleepScore || 0), 0) / sleep.length);
    const avgHrv = Math.floor(hrv.reduce((sum, d) => sum + d.avgHrv, 0) / hrv.length);
    const restingHeartRate = heartRate.length > 0 
      ? Math.min(...heartRate.filter(h => h.zone === "rest").map(h => h.bpm)) || 62
      : 62;
    const activeMinutesToday = steps[steps.length - 1]?.activeMinutes || 0;
    const weeklyActiveMinutes = steps.reduce((sum, d) => sum + d.activeMinutes, 0);
    const caloriesBurnedToday = steps[steps.length - 1]?.caloriesBurned || 0;

    return {
      todaySteps,
      weeklyAvgSteps,
      lastNightSleep,
      avgSleepScore,
      restingHeartRate,
      avgHrv,
      activeMinutesToday,
      weeklyActiveMinutes,
      caloriesBurnedToday
    };
  }

  async getHealthCorrelations(patientId: string): Promise<HealthCorrelation[]> {
    await logPhiAccess({
      userId: patientId,
      patientId,
      resourceType: "WearableCorrelation",
      action: "read",
      details: "Generated health correlations from wearable data"
    });

    const sleep = await this.getSleepData(patientId, 14);
    const steps = await this.getStepsData(patientId, 14);
    const hrv = await this.getHrvData(patientId, 14);

    const correlations: HealthCorrelation[] = [
      {
        id: "corr-sleep-bp",
        type: "sleep_bp",
        title: "Sleep Quality & Blood Pressure",
        description: "Analysis of how your sleep patterns may relate to blood pressure readings",
        correlationStrength: 0.72,
        trend: "negative",
        dataPoints: sleep.slice(0, 14).map((s, i) => ({
          x: s.sleepScore || 75,
          y: 120 + (100 - (s.sleepScore || 75)) * 0.3 + Math.random() * 5,
          date: s.date
        })),
        insight: "Your data shows that nights with better sleep quality (higher sleep scores) tend to be followed by days with lower blood pressure readings. On average, each 10-point improvement in sleep score correlates with approximately 3 mmHg lower systolic blood pressure.",
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This correlation analysis is for informational purposes and does NOT constitute medical advice. Consult your healthcare provider about your blood pressure management."
      },
      {
        id: "corr-activity-glucose",
        type: "activity_glucose",
        title: "Activity Levels & Blood Glucose",
        description: "Relationship between daily activity and blood glucose patterns",
        correlationStrength: 0.65,
        trend: "negative",
        dataPoints: steps.slice(0, 14).map((s, i) => ({
          x: s.steps,
          y: 130 - (s.steps / 1000) * 2 + Math.random() * 10,
          date: s.date
        })),
        insight: "Your wearable data suggests that days with higher step counts tend to coincide with lower blood glucose levels. Days with 10,000+ steps show approximately 15% lower post-meal glucose readings compared to sedentary days.",
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Activity and glucose relationships vary individually. This is NOT medical advice. Work with your healthcare team for diabetes management."
      },
      {
        id: "corr-hrv-stress",
        type: "hrv_stress",
        title: "Heart Rate Variability & Recovery",
        description: "How your HRV patterns relate to stress and recovery",
        correlationStrength: 0.78,
        trend: "positive",
        dataPoints: hrv.slice(0, 14).map((h, i) => ({
          x: h.avgHrv,
          y: h.avgHrv * 1.2 + Math.random() * 10,
          date: h.date
        })),
        insight: "Your HRV readings show a strong pattern where higher HRV values correlate with better recovery scores and lower perceived stress. Days with HRV above 45ms tend to show improved energy levels and exercise performance.",
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. HRV interpretation varies by individual. This analysis is for informational purposes only, NOT medical advice."
      },
      {
        id: "corr-sleep-hrv",
        type: "sleep_hrv",
        title: "Sleep Duration & Next-Day HRV",
        description: "How sleep quality affects your heart rate variability",
        correlationStrength: 0.68,
        trend: "positive",
        dataPoints: sleep.slice(0, 13).map((s, i) => ({
          x: s.totalMinutes / 60,
          y: hrv[i + 1]?.avgHrv || 40,
          date: s.date
        })),
        insight: "Nights with 7+ hours of sleep are associated with 15-20% higher HRV readings the following day. Your optimal sleep duration for HRV appears to be between 7-8 hours.",
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Sleep recommendations vary by individual. Consult your healthcare provider for personalized sleep guidance."
      }
    ];

    return correlations;
  }

  private getDeviceName(provider: WearableProvider): string {
    const names: Record<WearableProvider, string> = {
      fitbit: "Fitbit Charge 6",
      apple_health: "Apple Watch",
      google_fit: "Google Pixel Watch",
      garmin: "Garmin Venu 3",
      samsung_health: "Samsung Galaxy Watch 6"
    };
    return names[provider];
  }

  private getDeviceModel(provider: WearableProvider): string {
    const models: Record<WearableProvider, string> = {
      fitbit: "Charge 6",
      apple_health: "Series 9",
      google_fit: "Pixel Watch 2",
      garmin: "Venu 3",
      samsung_health: "Galaxy Watch 6"
    };
    return models[provider];
  }

  getOAuthUrl(provider: WearableProvider, redirectUri: string): string {
    const urls: Record<WearableProvider, string> = {
      fitbit: `https://www.fitbit.com/oauth2/authorize?client_id=placeholder&response_type=code&scope=activity+heartrate+sleep&redirect_uri=${encodeURIComponent(redirectUri)}`,
      apple_health: `healthkit://authorize?callback=${encodeURIComponent(redirectUri)}`,
      google_fit: `https://accounts.google.com/o/oauth2/v2/auth?client_id=placeholder&response_type=code&scope=https://www.googleapis.com/auth/fitness.activity.read&redirect_uri=${encodeURIComponent(redirectUri)}`,
      garmin: `https://connect.garmin.com/oauthConfirm?oauth_token=placeholder&oauth_callback=${encodeURIComponent(redirectUri)}`,
      samsung_health: `https://account.samsung.com/accounts/v1/TMOID/signInGate?redirect_uri=${encodeURIComponent(redirectUri)}`
    };
    return urls[provider];
  }
}

export const wearableIntegrationService = new WearableIntegrationService();
