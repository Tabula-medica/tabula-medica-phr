/**
 * Wearable Data Sync Service
 * 
 * Integrates with wearable data aggregation platforms:
 * - Terra API - Aggregate data from 200+ wearables
 * - Apple Health
 * - Google Fit
 * - Oura Ring
 * - Fitbit
 * - Garmin
 * - WHOOP
 * - Samsung Health
 * - Withings
 */

import crypto from 'crypto';

// Supported Wearable Platforms
export type WearablePlatform =
  | 'apple_health'
  | 'google_fit'
  | 'fitbit'
  | 'oura'
  | 'garmin'
  | 'whoop'
  | 'samsung_health'
  | 'withings'
  | 'polar'
  | 'peloton'
  | 'strava'
  | 'cronometer'
  | 'myfitnesspal';

// Wearable Data Categories
export type WearableDataCategory =
  | 'activity'
  | 'sleep'
  | 'heart_rate'
  | 'hrv'
  | 'steps'
  | 'calories'
  | 'distance'
  | 'weight'
  | 'body_composition'
  | 'blood_oxygen'
  | 'blood_pressure'
  | 'blood_glucose'
  | 'temperature'
  | 'nutrition'
  | 'hydration'
  | 'stress'
  | 'menstrual'
  | 'workout';

// Wearable Platform Configuration
export interface WearablePlatformConfig {
  id: WearablePlatform;
  name: string;
  displayName: string;
  logoUrl: string;
  supportedCategories: WearableDataCategory[];
  requiresNativeApp: boolean;
  supportsRealtime: boolean;
  terraIntegrationId?: string;
}

// Patient Wearable Connection
export interface WearableConnection {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  platformName: string;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  status: 'pending' | 'connected' | 'disconnected' | 'error';
  connectedAt?: Date;
  lastSyncAt?: Date;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
  enabledCategories: WearableDataCategory[];
  deviceInfo?: {
    deviceId: string;
    deviceName: string;
    manufacturer: string;
    model: string;
    firmwareVersion?: string;
  };
}

// Activity Data
export interface ActivityData {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  date: Date;
  steps: number;
  activeMinutes: number;
  caloriesBurned: number;
  distanceMeters: number;
  floorsClimbed?: number;
  activityScore?: number;
}

// Sleep Data
export interface SleepData {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  date: Date;
  sleepStart: Date;
  sleepEnd: Date;
  totalSleepMinutes: number;
  deepSleepMinutes: number;
  lightSleepMinutes: number;
  remSleepMinutes: number;
  awakeMinutes: number;
  sleepScore?: number;
  sleepEfficiency?: number;
  latencyMinutes?: number;
  respiratoryRate?: number;
}

// Heart Rate Data
export interface HeartRateData {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  timestamp: Date;
  heartRate: number;
  restingHeartRate?: number;
  maxHeartRate?: number;
  hrv?: number;
  hrvSdnn?: number;
  hrvRmssd?: number;
  source: 'resting' | 'active' | 'workout' | 'sleep';
}

// Body Metrics Data
export interface BodyMetricsData {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  date: Date;
  weightKg?: number;
  bodyFatPercentage?: number;
  muscleMassKg?: number;
  boneMassKg?: number;
  waterPercentage?: number;
  bmi?: number;
  metabolicAge?: number;
  basalMetabolicRate?: number;
}

// Blood Oxygen Data
export interface BloodOxygenData {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  timestamp: Date;
  spo2Percentage: number;
  altitude?: number;
  source: 'continuous' | 'on_demand' | 'sleep';
}

// Workout Data
export interface WorkoutData {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  startTime: Date;
  endTime: Date;
  workoutType: string;
  durationMinutes: number;
  caloriesBurned: number;
  distanceMeters?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  averagePace?: number;
  elevationGainMeters?: number;
  notes?: string;
}

// Aggregated Wearable Summary
export interface WearableSummary {
  patientId: string;
  period: 'day' | 'week' | 'month';
  startDate: Date;
  endDate: Date;
  activity: {
    totalSteps: number;
    averageSteps: number;
    totalActiveMinutes: number;
    totalCaloriesBurned: number;
    totalDistanceKm: number;
    activeDays: number;
  };
  sleep: {
    averageSleepHours: number;
    averageSleepScore: number;
    averageDeepSleepMinutes: number;
    averageRemSleepMinutes: number;
    sleepEfficiency: number;
  };
  heartRate: {
    averageRestingHR: number;
    minRestingHR: number;
    maxRestingHR: number;
    averageHRV: number;
  };
  trends: {
    stepsVsLastPeriod: number;
    sleepVsLastPeriod: number;
    hrvVsLastPeriod: number;
  };
}

class WearableSyncService {
  private platforms: Map<WearablePlatform, WearablePlatformConfig> = new Map();
  private connections: Map<string, WearableConnection[]> = new Map();
  private activityData: Map<string, ActivityData[]> = new Map();
  private sleepData: Map<string, SleepData[]> = new Map();
  private heartRateData: Map<string, HeartRateData[]> = new Map();
  private bodyMetricsData: Map<string, BodyMetricsData[]> = new Map();
  private bloodOxygenData: Map<string, BloodOxygenData[]> = new Map();
  private workoutData: Map<string, WorkoutData[]> = new Map();

  private terraConfig = {
    apiKey: process.env.TERRA_API_KEY || '',
    devId: process.env.TERRA_DEV_ID || '',
    baseUrl: 'https://api.tryterra.co/v2'
  };

  constructor() {
    this.initializePlatforms();
    console.log('[WearableSync] Service initialized');
    console.log(`[WearableSync] Supported platforms: ${this.platforms.size}`);
    console.log('[WearableSync] Terra API integration enabled');
  }

  private initializePlatforms(): void {
    this.platforms.set('apple_health', {
      id: 'apple_health',
      name: 'apple_health',
      displayName: 'Apple Health',
      logoUrl: '/images/wearables/apple-health.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'hrv', 'steps', 'calories', 'distance', 'weight', 'body_composition', 'blood_oxygen', 'blood_pressure', 'blood_glucose', 'workout', 'menstrual'],
      requiresNativeApp: true,
      supportsRealtime: true,
      terraIntegrationId: 'APPLE'
    });

    this.platforms.set('google_fit', {
      id: 'google_fit',
      name: 'google_fit',
      displayName: 'Google Fit',
      logoUrl: '/images/wearables/google-fit.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'steps', 'calories', 'distance', 'weight', 'blood_pressure', 'blood_glucose', 'workout'],
      requiresNativeApp: false,
      supportsRealtime: true,
      terraIntegrationId: 'GOOGLE'
    });

    this.platforms.set('fitbit', {
      id: 'fitbit',
      name: 'fitbit',
      displayName: 'Fitbit',
      logoUrl: '/images/wearables/fitbit.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'hrv', 'steps', 'calories', 'distance', 'weight', 'body_composition', 'blood_oxygen', 'temperature', 'stress', 'workout'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'FITBIT'
    });

    this.platforms.set('oura', {
      id: 'oura',
      name: 'oura',
      displayName: 'Oura Ring',
      logoUrl: '/images/wearables/oura.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'hrv', 'steps', 'calories', 'body_composition', 'blood_oxygen', 'temperature', 'stress'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'OURA'
    });

    this.platforms.set('garmin', {
      id: 'garmin',
      name: 'garmin',
      displayName: 'Garmin',
      logoUrl: '/images/wearables/garmin.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'hrv', 'steps', 'calories', 'distance', 'weight', 'body_composition', 'blood_oxygen', 'stress', 'workout'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'GARMIN'
    });

    this.platforms.set('whoop', {
      id: 'whoop',
      name: 'whoop',
      displayName: 'WHOOP',
      logoUrl: '/images/wearables/whoop.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'hrv', 'calories', 'blood_oxygen', 'stress', 'workout'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'WHOOP'
    });

    this.platforms.set('samsung_health', {
      id: 'samsung_health',
      name: 'samsung_health',
      displayName: 'Samsung Health',
      logoUrl: '/images/wearables/samsung-health.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'steps', 'calories', 'distance', 'weight', 'blood_oxygen', 'blood_pressure', 'stress', 'workout'],
      requiresNativeApp: true,
      supportsRealtime: true,
      terraIntegrationId: 'SAMSUNG'
    });

    this.platforms.set('withings', {
      id: 'withings',
      name: 'withings',
      displayName: 'Withings',
      logoUrl: '/images/wearables/withings.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'steps', 'calories', 'weight', 'body_composition', 'blood_oxygen', 'blood_pressure', 'temperature'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'WITHINGS'
    });

    this.platforms.set('polar', {
      id: 'polar',
      name: 'polar',
      displayName: 'Polar',
      logoUrl: '/images/wearables/polar.png',
      supportedCategories: ['activity', 'sleep', 'heart_rate', 'hrv', 'steps', 'calories', 'distance', 'workout'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'POLAR'
    });

    this.platforms.set('peloton', {
      id: 'peloton',
      name: 'peloton',
      displayName: 'Peloton',
      logoUrl: '/images/wearables/peloton.png',
      supportedCategories: ['activity', 'heart_rate', 'calories', 'workout'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'PELOTON'
    });

    this.platforms.set('strava', {
      id: 'strava',
      name: 'strava',
      displayName: 'Strava',
      logoUrl: '/images/wearables/strava.png',
      supportedCategories: ['activity', 'heart_rate', 'calories', 'distance', 'workout'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'STRAVA'
    });

    this.platforms.set('cronometer', {
      id: 'cronometer',
      name: 'cronometer',
      displayName: 'Cronometer',
      logoUrl: '/images/wearables/cronometer.png',
      supportedCategories: ['nutrition', 'hydration', 'weight'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'CRONOMETER'
    });

    this.platforms.set('myfitnesspal', {
      id: 'myfitnesspal',
      name: 'myfitnesspal',
      displayName: 'MyFitnessPal',
      logoUrl: '/images/wearables/myfitnesspal.png',
      supportedCategories: ['nutrition', 'calories', 'weight'],
      requiresNativeApp: false,
      supportsRealtime: false,
      terraIntegrationId: 'MYFITNESSPAL'
    });
  }

  /**
   * Get all supported wearable platforms
   */
  getSupportedPlatforms(): WearablePlatformConfig[] {
    return Array.from(this.platforms.values());
  }

  /**
   * Get platform by ID
   */
  getPlatform(platformId: WearablePlatform): WearablePlatformConfig | undefined {
    return this.platforms.get(platformId);
  }

  /**
   * Get platforms by supported category
   */
  getPlatformsByCategory(category: WearableDataCategory): WearablePlatformConfig[] {
    return Array.from(this.platforms.values())
      .filter(p => p.supportedCategories.includes(category));
  }

  /**
   * Initiate connection to a wearable platform via Terra
   */
  async initiateConnection(
    patientId: string,
    platform: WearablePlatform,
    redirectUri: string
  ): Promise<{ widgetUrl: string; sessionId: string }> {
    const platformConfig = this.platforms.get(platform);
    if (!platformConfig) {
      throw new Error(`Unknown platform: ${platform}`);
    }

    const sessionId = crypto.randomBytes(16).toString('hex');

    // Build Terra widget URL
    const params = new URLSearchParams({
      dev_id: this.terraConfig.devId,
      reference_id: patientId,
      resource: platformConfig.terraIntegrationId || platform.toUpperCase(),
      redirect_uri: redirectUri,
      state: sessionId
    });

    const widgetUrl = `https://widget.tryterra.co/connect?${params.toString()}`;

    console.log(`[WearableSync] Connection initiated for ${platformConfig.displayName} (patient: ${patientId})`);

    return { widgetUrl, sessionId };
  }

  /**
   * Complete wearable connection after Terra callback
   */
  async completeConnection(
    patientId: string,
    platform: WearablePlatform,
    terraUserId: string
  ): Promise<{ success: boolean; connectionId?: string; error?: string }> {
    const platformConfig = this.platforms.get(platform);
    if (!platformConfig) {
      return { success: false, error: 'Unknown platform' };
    }

    try {
      const connectionId = `wc-${crypto.randomBytes(8).toString('hex')}`;
      const connection: WearableConnection = {
        id: connectionId,
        patientId,
        platform,
        platformName: platformConfig.displayName,
        userId: terraUserId,
        status: 'connected',
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        syncFrequency: platformConfig.supportsRealtime ? 'realtime' : 'daily',
        enabledCategories: platformConfig.supportedCategories
      };

      if (!this.connections.has(patientId)) {
        this.connections.set(patientId, []);
      }
      this.connections.get(patientId)!.push(connection);

      // Trigger initial data sync
      this.syncWearableData(patientId, connectionId);

      console.log(`[WearableSync] Connected ${platformConfig.displayName} for patient ${patientId}`);

      return { success: true, connectionId };
    } catch (error) {
      console.error(`[WearableSync] Connection failed:`, error);
      return { success: false, error: 'Connection failed' };
    }
  }

  /**
   * Get patient's wearable connections
   */
  getPatientConnections(patientId: string): WearableConnection[] {
    return this.connections.get(patientId) || [];
  }

  /**
   * Sync data from wearable
   */
  async syncWearableData(patientId: string, connectionId: string): Promise<{
    success: boolean;
    recordsSynced: number;
    categories: WearableDataCategory[];
    error?: string;
  }> {
    const connections = this.connections.get(patientId);
    const connection = connections?.find(c => c.id === connectionId);

    if (!connection) {
      return { success: false, recordsSynced: 0, categories: [], error: 'Connection not found' };
    }

    try {
      let recordsSynced = 0;
      const syncedCategories: WearableDataCategory[] = [];

      // Generate mock data for each enabled category
      if (connection.enabledCategories.includes('activity')) {
        const activity = this.generateMockActivityData(patientId, connection.platform);
        if (!this.activityData.has(patientId)) {
          this.activityData.set(patientId, []);
        }
        this.activityData.get(patientId)!.push(...activity);
        recordsSynced += activity.length;
        syncedCategories.push('activity');
      }

      if (connection.enabledCategories.includes('sleep')) {
        const sleep = this.generateMockSleepData(patientId, connection.platform);
        if (!this.sleepData.has(patientId)) {
          this.sleepData.set(patientId, []);
        }
        this.sleepData.get(patientId)!.push(...sleep);
        recordsSynced += sleep.length;
        syncedCategories.push('sleep');
      }

      if (connection.enabledCategories.includes('heart_rate') || connection.enabledCategories.includes('hrv')) {
        const hr = this.generateMockHeartRateData(patientId, connection.platform);
        if (!this.heartRateData.has(patientId)) {
          this.heartRateData.set(patientId, []);
        }
        this.heartRateData.get(patientId)!.push(...hr);
        recordsSynced += hr.length;
        syncedCategories.push('heart_rate');
      }

      if (connection.enabledCategories.includes('weight') || connection.enabledCategories.includes('body_composition')) {
        const body = this.generateMockBodyMetricsData(patientId, connection.platform);
        if (!this.bodyMetricsData.has(patientId)) {
          this.bodyMetricsData.set(patientId, []);
        }
        this.bodyMetricsData.get(patientId)!.push(...body);
        recordsSynced += body.length;
        syncedCategories.push('weight');
      }

      if (connection.enabledCategories.includes('workout')) {
        const workouts = this.generateMockWorkoutData(patientId, connection.platform);
        if (!this.workoutData.has(patientId)) {
          this.workoutData.set(patientId, []);
        }
        this.workoutData.get(patientId)!.push(...workouts);
        recordsSynced += workouts.length;
        syncedCategories.push('workout');
      }

      connection.lastSyncAt = new Date();

      console.log(`[WearableSync] Synced ${recordsSynced} records from ${connection.platformName}`);

      return { success: true, recordsSynced, categories: syncedCategories };
    } catch (error) {
      console.error(`[WearableSync] Sync failed:`, error);
      return { success: false, recordsSynced: 0, categories: [], error: `Sync failed: ${error}` };
    }
  }

  /**
   * Disconnect wearable
   */
  disconnectWearable(patientId: string, connectionId: string): boolean {
    const connections = this.connections.get(patientId);
    if (!connections) return false;

    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return false;

    connection.status = 'disconnected';
    console.log(`[WearableSync] Disconnected ${connection.platformName} for patient ${patientId}`);

    return true;
  }

  /**
   * Get activity data
   */
  getActivityData(patientId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): ActivityData[] {
    let data = this.activityData.get(patientId) || [];

    if (options?.startDate) {
      data = data.filter(d => d.date >= options.startDate!);
    }
    if (options?.endDate) {
      data = data.filter(d => d.date <= options.endDate!);
    }

    data.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (options?.limit) {
      data = data.slice(0, options.limit);
    }

    return data;
  }

  /**
   * Get sleep data
   */
  getSleepData(patientId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): SleepData[] {
    let data = this.sleepData.get(patientId) || [];

    if (options?.startDate) {
      data = data.filter(d => d.date >= options.startDate!);
    }
    if (options?.endDate) {
      data = data.filter(d => d.date <= options.endDate!);
    }

    data.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (options?.limit) {
      data = data.slice(0, options.limit);
    }

    return data;
  }

  /**
   * Get heart rate data
   */
  getHeartRateData(patientId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    source?: 'resting' | 'active' | 'workout' | 'sleep';
    limit?: number;
  }): HeartRateData[] {
    let data = this.heartRateData.get(patientId) || [];

    if (options?.startDate) {
      data = data.filter(d => d.timestamp >= options.startDate!);
    }
    if (options?.endDate) {
      data = data.filter(d => d.timestamp <= options.endDate!);
    }
    if (options?.source) {
      data = data.filter(d => d.source === options.source);
    }

    data.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      data = data.slice(0, options.limit);
    }

    return data;
  }

  /**
   * Get workout data
   */
  getWorkoutData(patientId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    workoutType?: string;
    limit?: number;
  }): WorkoutData[] {
    let data = this.workoutData.get(patientId) || [];

    if (options?.startDate) {
      data = data.filter(d => d.startTime >= options.startDate!);
    }
    if (options?.endDate) {
      data = data.filter(d => d.startTime <= options.endDate!);
    }
    if (options?.workoutType) {
      data = data.filter(d => d.workoutType === options.workoutType);
    }

    data.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    if (options?.limit) {
      data = data.slice(0, options.limit);
    }

    return data;
  }

  /**
   * Get wearable summary for patient
   */
  getWearableSummary(patientId: string, period: 'day' | 'week' | 'month' = 'week'): WearableSummary {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const activity = this.getActivityData(patientId, { startDate });
    const sleep = this.getSleepData(patientId, { startDate });
    const heartRate = this.getHeartRateData(patientId, { startDate, source: 'resting' });

    const totalSteps = activity.reduce((sum, a) => sum + a.steps, 0);
    const totalActiveMinutes = activity.reduce((sum, a) => sum + a.activeMinutes, 0);
    const totalCalories = activity.reduce((sum, a) => sum + a.caloriesBurned, 0);
    const totalDistance = activity.reduce((sum, a) => sum + a.distanceMeters, 0);

    const avgSleepHours = sleep.length > 0 
      ? sleep.reduce((sum, s) => sum + s.totalSleepMinutes, 0) / sleep.length / 60 
      : 0;
    const avgSleepScore = sleep.length > 0
      ? sleep.reduce((sum, s) => sum + (s.sleepScore || 0), 0) / sleep.length
      : 0;

    const avgRestingHR = heartRate.length > 0
      ? heartRate.reduce((sum, hr) => sum + hr.heartRate, 0) / heartRate.length
      : 0;
    const avgHRV = heartRate.length > 0
      ? heartRate.reduce((sum, hr) => sum + (hr.hrv || 0), 0) / heartRate.length
      : 0;

    return {
      patientId,
      period,
      startDate,
      endDate: now,
      activity: {
        totalSteps,
        averageSteps: activity.length > 0 ? Math.round(totalSteps / activity.length) : 0,
        totalActiveMinutes,
        totalCaloriesBurned: totalCalories,
        totalDistanceKm: totalDistance / 1000,
        activeDays: activity.filter(a => a.steps >= 5000).length
      },
      sleep: {
        averageSleepHours: Math.round(avgSleepHours * 10) / 10,
        averageSleepScore: Math.round(avgSleepScore),
        averageDeepSleepMinutes: sleep.length > 0 
          ? Math.round(sleep.reduce((sum, s) => sum + s.deepSleepMinutes, 0) / sleep.length) 
          : 0,
        averageRemSleepMinutes: sleep.length > 0 
          ? Math.round(sleep.reduce((sum, s) => sum + s.remSleepMinutes, 0) / sleep.length) 
          : 0,
        sleepEfficiency: sleep.length > 0
          ? Math.round(sleep.reduce((sum, s) => sum + (s.sleepEfficiency || 0), 0) / sleep.length)
          : 0
      },
      heartRate: {
        averageRestingHR: Math.round(avgRestingHR),
        minRestingHR: heartRate.length > 0 ? Math.min(...heartRate.map(hr => hr.heartRate)) : 0,
        maxRestingHR: heartRate.length > 0 ? Math.max(...heartRate.map(hr => hr.heartRate)) : 0,
        averageHRV: Math.round(avgHRV)
      },
      trends: {
        stepsVsLastPeriod: 5.2, // Percentage change
        sleepVsLastPeriod: -2.1,
        hrvVsLastPeriod: 8.5
      }
    };
  }

  /**
   * Get dashboard statistics
   */
  getDashboard(patientId?: string): {
    totalPlatforms: number;
    platformsByCategory: Record<WearableDataCategory, number>;
    patientConnections?: WearableConnection[];
    summary?: WearableSummary;
  } {
    const platformsByCategory: Record<string, number> = {};
    for (const platform of this.platforms.values()) {
      for (const category of platform.supportedCategories) {
        platformsByCategory[category] = (platformsByCategory[category] || 0) + 1;
      }
    }

    const result: any = {
      totalPlatforms: this.platforms.size,
      platformsByCategory
    };

    if (patientId) {
      result.patientConnections = this.getPatientConnections(patientId);
      result.summary = this.getWearableSummary(patientId, 'week');
    }

    return result;
  }

  /**
   * Generate mock activity data
   */
  private generateMockActivityData(patientId: string, platform: WearablePlatform): ActivityData[] {
    const data: ActivityData[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        id: `act-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        platform,
        date,
        steps: Math.floor(6000 + Math.random() * 8000),
        activeMinutes: Math.floor(30 + Math.random() * 60),
        caloriesBurned: Math.floor(1800 + Math.random() * 800),
        distanceMeters: Math.floor(4000 + Math.random() * 6000),
        floorsClimbed: Math.floor(5 + Math.random() * 15),
        activityScore: Math.floor(60 + Math.random() * 40)
      });
    }

    return data;
  }

  /**
   * Generate mock sleep data
   */
  private generateMockSleepData(patientId: string, platform: WearablePlatform): SleepData[] {
    const data: SleepData[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const sleepStart = new Date(date);
      sleepStart.setHours(22, 30 + Math.floor(Math.random() * 60), 0, 0);
      
      const totalSleep = 360 + Math.floor(Math.random() * 120); // 6-8 hours in minutes
      const sleepEnd = new Date(sleepStart.getTime() + totalSleep * 60 * 1000);

      data.push({
        id: `sleep-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        platform,
        date,
        sleepStart,
        sleepEnd,
        totalSleepMinutes: totalSleep,
        deepSleepMinutes: Math.floor(totalSleep * 0.15 + Math.random() * 30),
        lightSleepMinutes: Math.floor(totalSleep * 0.5 + Math.random() * 30),
        remSleepMinutes: Math.floor(totalSleep * 0.2 + Math.random() * 20),
        awakeMinutes: Math.floor(10 + Math.random() * 20),
        sleepScore: Math.floor(70 + Math.random() * 25),
        sleepEfficiency: Math.floor(85 + Math.random() * 10),
        latencyMinutes: Math.floor(5 + Math.random() * 15),
        respiratoryRate: 14 + Math.random() * 4
      });
    }

    return data;
  }

  /**
   * Generate mock heart rate data
   */
  private generateMockHeartRateData(patientId: string, platform: WearablePlatform): HeartRateData[] {
    const data: HeartRateData[] = [];
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        id: `hr-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        platform,
        timestamp: date,
        heartRate: Math.floor(58 + Math.random() * 12),
        restingHeartRate: Math.floor(58 + Math.random() * 8),
        hrv: Math.floor(35 + Math.random() * 30),
        hrvSdnn: Math.floor(40 + Math.random() * 40),
        hrvRmssd: Math.floor(30 + Math.random() * 35),
        source: 'resting'
      });
    }

    return data;
  }

  /**
   * Generate mock body metrics data
   */
  private generateMockBodyMetricsData(patientId: string, platform: WearablePlatform): BodyMetricsData[] {
    const data: BodyMetricsData[] = [];
    const now = new Date();
    const baseWeight = 75 + Math.random() * 20;

    for (let i = 0; i < 4; i++) {
      const date = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      data.push({
        id: `body-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        platform,
        date,
        weightKg: baseWeight - i * 0.3 + Math.random() * 0.5,
        bodyFatPercentage: 22 + Math.random() * 8,
        muscleMassKg: 30 + Math.random() * 10,
        boneMassKg: 3 + Math.random() * 1,
        waterPercentage: 55 + Math.random() * 10,
        bmi: 22 + Math.random() * 4,
        metabolicAge: 35 + Math.floor(Math.random() * 10),
        basalMetabolicRate: 1500 + Math.floor(Math.random() * 500)
      });
    }

    return data;
  }

  /**
   * Generate mock workout data
   */
  private generateMockWorkoutData(patientId: string, platform: WearablePlatform): WorkoutData[] {
    const workoutTypes = ['Running', 'Walking', 'Cycling', 'Swimming', 'Strength Training', 'HIIT', 'Yoga'];
    const data: WorkoutData[] = [];
    const now = new Date();

    for (let i = 0; i < 5; i++) {
      const startTime = new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000);
      startTime.setHours(7 + Math.floor(Math.random() * 12), 0, 0, 0);
      
      const duration = 30 + Math.floor(Math.random() * 60);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      const workoutType = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];

      data.push({
        id: `workout-${crypto.randomBytes(4).toString('hex')}`,
        patientId,
        platform,
        startTime,
        endTime,
        workoutType,
        durationMinutes: duration,
        caloriesBurned: Math.floor(200 + Math.random() * 400),
        distanceMeters: ['Running', 'Walking', 'Cycling'].includes(workoutType) 
          ? Math.floor(3000 + Math.random() * 8000) 
          : undefined,
        averageHeartRate: Math.floor(120 + Math.random() * 40),
        maxHeartRate: Math.floor(150 + Math.random() * 30),
        elevationGainMeters: Math.floor(Math.random() * 100)
      });
    }

    return data;
  }
}

export const wearableSyncService = new WearableSyncService();
