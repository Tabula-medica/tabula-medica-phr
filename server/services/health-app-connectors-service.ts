import crypto from 'crypto';

export type HealthAppPlatform =
  | 'myfitnesspal'
  | 'strava'
  | 'peloton'
  | 'noom'
  | 'cronometer'
  | 'lose_it';

export type HealthAppDataType =
  | 'nutrition'
  | 'calories_consumed'
  | 'macronutrients'
  | 'micronutrients'
  | 'meals'
  | 'water_intake'
  | 'workouts'
  | 'running'
  | 'cycling'
  | 'weight_log'
  | 'body_measurements'
  | 'food_diary';

export interface HealthAppConnection {
  id: string;
  platform: HealthAppPlatform;
  displayName: string;
  username: string;
  status: 'connected' | 'disconnected' | 'expired' | 'pending_auth' | 'error';
  authMethod: 'oauth2' | 'api_key';
  lastSync: string | null;
  connectedAt: string | null;
  dataTypes: HealthAppDataType[];
  recordCount: number;
  syncFrequency: 'realtime' | 'hourly' | 'daily';
}

export interface HealthAppDataPoint {
  id: string;
  connectionId: string;
  platform: HealthAppPlatform;
  dataType: HealthAppDataType;
  value: number | Record<string, unknown>;
  unit: string;
  timestamp: string;
  source: string;
  confidence: number;
}

export interface NutritionEntry {
  id: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  servingSize: string;
  calories: number;
  macros: { protein: number; carbs: number; fat: number; fiber: number };
  micros?: { sodium: number; potassium: number; calcium: number; iron: number; vitaminA: number; vitaminC: number; vitaminD: number };
  timestamp: string;
  verified: boolean;
}

export interface DailyNutritionSummary {
  date: string;
  totalCalories: number;
  calorieGoal: number;
  macros: { protein: number; carbs: number; fat: number; fiber: number };
  macroGoals: { protein: number; carbs: number; fat: number; fiber: number };
  waterIntake: number;
  waterGoal: number;
  mealCount: number;
  meals: NutritionEntry[];
}

export interface HealthAppSyncResult {
  syncId: string;
  connectionId: string;
  platform: HealthAppPlatform;
  status: 'completed' | 'partial' | 'failed';
  recordsSynced: number;
  newRecords: number;
  updatedRecords: number;
  errors: string[];
  syncedDataTypes: HealthAppDataType[];
  duration: number;
  syncedAt: string;
}

export interface HealthAppPlatformInfo {
  platform: HealthAppPlatform;
  displayName: string;
  category: 'nutrition' | 'fitness' | 'wellness';
  description: string;
  authMethod: 'oauth2' | 'api_key';
  supportedDataTypes: HealthAppDataType[];
  primaryFocus: string;
  userBase: string;
  logoColor: string;
}

const HEALTH_APP_PLATFORMS: HealthAppPlatformInfo[] = [
  {
    platform: 'myfitnesspal',
    displayName: 'MyFitnessPal',
    category: 'nutrition',
    description: 'Comprehensive nutrition tracking with a database of 14+ million foods. Tracks calories, macronutrients, micronutrients, and water intake with barcode scanning.',
    authMethod: 'oauth2',
    supportedDataTypes: ['nutrition', 'calories_consumed', 'macronutrients', 'micronutrients', 'meals', 'water_intake', 'food_diary', 'weight_log'],
    primaryFocus: 'Nutrition & Calorie Tracking',
    userBase: '200M+ users',
    logoColor: '#0066EE'
  },
  {
    platform: 'strava',
    displayName: 'Strava',
    category: 'fitness',
    description: 'GPS-based activity tracking for running, cycling, swimming, and 30+ sport types. Provides segment analysis, training logs, and performance metrics.',
    authMethod: 'oauth2',
    supportedDataTypes: ['workouts', 'running', 'cycling', 'calories_consumed'],
    primaryFocus: 'Activity & Performance Tracking',
    userBase: '120M+ athletes',
    logoColor: '#FC4C02'
  },
  {
    platform: 'peloton',
    displayName: 'Peloton',
    category: 'fitness',
    description: 'Connected fitness platform with structured workout data from cycling, running, strength, yoga, and meditation classes with heart rate zone tracking.',
    authMethod: 'oauth2',
    supportedDataTypes: ['workouts', 'calories_consumed', 'cycling'],
    primaryFocus: 'Structured Fitness Classes',
    userBase: '7M+ members',
    logoColor: '#000000'
  },
  {
    platform: 'noom',
    displayName: 'Noom',
    category: 'wellness',
    description: 'Psychology-based wellness platform with food logging using a color-coded system, weight tracking, and behavioral health insights.',
    authMethod: 'oauth2',
    supportedDataTypes: ['nutrition', 'calories_consumed', 'meals', 'weight_log', 'food_diary'],
    primaryFocus: 'Behavioral Health & Weight Management',
    userBase: '50M+ users',
    logoColor: '#FF6B35'
  },
  {
    platform: 'cronometer',
    displayName: 'Cronometer',
    category: 'nutrition',
    description: 'Precision nutrition tracker with detailed micronutrient analysis, tracking 82+ nutrients from curated databases including NCCDB and USDA.',
    authMethod: 'api_key',
    supportedDataTypes: ['nutrition', 'calories_consumed', 'macronutrients', 'micronutrients', 'meals', 'water_intake', 'food_diary', 'body_measurements'],
    primaryFocus: 'Detailed Micronutrient Analysis',
    userBase: '10M+ users',
    logoColor: '#FF9500'
  },
  {
    platform: 'lose_it',
    displayName: 'Lose It!',
    category: 'nutrition',
    description: 'Calorie counting and weight loss app with food recognition AI, macro tracking, and integration with major fitness platforms.',
    authMethod: 'oauth2',
    supportedDataTypes: ['nutrition', 'calories_consumed', 'macronutrients', 'meals', 'water_intake', 'weight_log', 'food_diary'],
    primaryFocus: 'Calorie Counting & Weight Loss',
    userBase: '45M+ users',
    logoColor: '#4CAF50'
  }
];

class HealthAppConnectorService {
  private connections: Map<string, HealthAppConnection> = new Map();
  private dataPoints: Map<string, HealthAppDataPoint[]> = new Map();
  private nutritionData: Map<string, DailyNutritionSummary[]> = new Map();
  private syncResults: Map<string, HealthAppSyncResult[]> = new Map();

  constructor() {
    if (process.env.NODE_ENV !== 'production') {
      this.initSampleData();
    }
    console.log(`[HealthAppConnectors] Service initialized with ${HEALTH_APP_PLATFORMS.length} supported platforms`);
    console.log(`[HealthAppConnectors] Platforms: ${HEALTH_APP_PLATFORMS.map(p => p.displayName).join(', ')}`);
  }

  private initSampleData(): void {
    const myFitnessPalConn: HealthAppConnection = {
      id: 'app_mfp_001',
      platform: 'myfitnesspal',
      displayName: 'MyFitnessPal',
      username: 'healthuser_sample',
      status: 'connected',
      authMethod: 'oauth2',
      lastSync: new Date(Date.now() - 3600000).toISOString(),
      connectedAt: '2025-10-01T08:00:00Z',
      dataTypes: ['nutrition', 'calories_consumed', 'macronutrients', 'micronutrients', 'meals', 'water_intake', 'food_diary', 'weight_log'],
      recordCount: 1245,
      syncFrequency: 'daily'
    };

    const stravaConn: HealthAppConnection = {
      id: 'app_strava_001',
      platform: 'strava',
      displayName: 'Strava',
      username: 'runner_sample',
      status: 'connected',
      authMethod: 'oauth2',
      lastSync: new Date(Date.now() - 7200000).toISOString(),
      connectedAt: '2025-11-15T10:00:00Z',
      dataTypes: ['workouts', 'running', 'cycling', 'calories_consumed'],
      recordCount: 342,
      syncFrequency: 'hourly'
    };

    const cronometerConn: HealthAppConnection = {
      id: 'app_crono_001',
      platform: 'cronometer',
      displayName: 'Cronometer',
      username: 'nutrition_sample',
      status: 'disconnected',
      authMethod: 'api_key',
      lastSync: '2025-12-20T14:00:00Z',
      connectedAt: '2025-07-10T09:00:00Z',
      dataTypes: ['nutrition', 'calories_consumed', 'macronutrients', 'micronutrients', 'meals'],
      recordCount: 890,
      syncFrequency: 'daily'
    };

    this.connections.set(myFitnessPalConn.id, myFitnessPalConn);
    this.connections.set(stravaConn.id, stravaConn);
    this.connections.set(cronometerConn.id, cronometerConn);

    this.initSampleNutrition('app_mfp_001');
    this.initSampleWorkouts('app_strava_001');
  }

  private initSampleNutrition(connectionId: string): void {
    const today = new Date().toISOString().split('T')[0];
    const meals: NutritionEntry[] = [
      {
        id: crypto.randomUUID(), mealType: 'breakfast', foodName: 'Greek Yogurt with Berries & Granola',
        servingSize: '1 bowl (350g)', calories: 380,
        macros: { protein: 22, carbs: 48, fat: 12, fiber: 5 },
        micros: { sodium: 85, potassium: 420, calcium: 280, iron: 2.1, vitaminA: 120, vitaminC: 18, vitaminD: 80 },
        timestamp: `${today}T07:30:00Z`, verified: true
      },
      {
        id: crypto.randomUUID(), mealType: 'lunch', foodName: 'Grilled Chicken Salad with Quinoa',
        servingSize: '1 plate (450g)', calories: 520,
        macros: { protein: 42, carbs: 35, fat: 22, fiber: 8 },
        micros: { sodium: 580, potassium: 680, calcium: 120, iron: 3.5, vitaminA: 380, vitaminC: 35, vitaminD: 15 },
        timestamp: `${today}T12:15:00Z`, verified: true
      },
      {
        id: crypto.randomUUID(), mealType: 'snack', foodName: 'Apple with Almond Butter',
        servingSize: '1 medium apple + 2 tbsp', calories: 267,
        macros: { protein: 7, carbs: 32, fat: 16, fiber: 5 },
        micros: { sodium: 2, potassium: 320, calcium: 76, iron: 0.8, vitaminA: 54, vitaminC: 8, vitaminD: 0 },
        timestamp: `${today}T15:30:00Z`, verified: true
      },
      {
        id: crypto.randomUUID(), mealType: 'dinner', foodName: 'Salmon with Sweet Potato & Steamed Broccoli',
        servingSize: '1 plate (500g)', calories: 645,
        macros: { protein: 38, carbs: 52, fat: 28, fiber: 9 },
        micros: { sodium: 420, potassium: 920, calcium: 95, iron: 2.8, vitaminA: 1420, vitaminC: 65, vitaminD: 580 },
        timestamp: `${today}T18:45:00Z`, verified: true
      }
    ];

    const summary: DailyNutritionSummary = {
      date: today,
      totalCalories: meals.reduce((sum, m) => sum + m.calories, 0),
      calorieGoal: 2200,
      macros: {
        protein: meals.reduce((sum, m) => sum + m.macros.protein, 0),
        carbs: meals.reduce((sum, m) => sum + m.macros.carbs, 0),
        fat: meals.reduce((sum, m) => sum + m.macros.fat, 0),
        fiber: meals.reduce((sum, m) => sum + m.macros.fiber, 0)
      },
      macroGoals: { protein: 120, carbs: 220, fat: 75, fiber: 30 },
      waterIntake: 2400,
      waterGoal: 3000,
      mealCount: meals.length,
      meals
    };

    this.nutritionData.set(connectionId, [summary]);
  }

  private initSampleWorkouts(connectionId: string): void {
    const now = new Date();
    const workoutPoints: HealthAppDataPoint[] = [
      {
        id: crypto.randomUUID(), connectionId, platform: 'strava', dataType: 'running',
        value: { distance: 8.2, duration: 2580, pace: '5:15 /km', elevationGain: 85, avgHeartRate: 152, maxHeartRate: 178, calories: 620, splits: [312, 308, 315, 322, 310, 318, 305, 290] },
        unit: 'workout', timestamp: new Date(now.getTime() - 86400000).toISOString(), source: 'Strava', confidence: 0.98
      },
      {
        id: crypto.randomUUID(), connectionId, platform: 'strava', dataType: 'cycling',
        value: { distance: 32.5, duration: 4200, avgSpeed: 27.9, elevationGain: 420, avgPower: 185, avgHeartRate: 142, maxHeartRate: 168, calories: 890 },
        unit: 'workout', timestamp: new Date(now.getTime() - 2 * 86400000).toISOString(), source: 'Strava', confidence: 0.97
      },
      {
        id: crypto.randomUUID(), connectionId, platform: 'strava', dataType: 'workouts',
        value: { type: 'trail_run', distance: 12.8, duration: 4620, elevationGain: 340, avgHeartRate: 148, calories: 980, weatherTemp: 8, surface: 'trail' },
        unit: 'workout', timestamp: new Date(now.getTime() - 4 * 86400000).toISOString(), source: 'Strava', confidence: 0.96
      }
    ];

    this.dataPoints.set(connectionId, workoutPoints);
  }

  getSupportedPlatforms(): HealthAppPlatformInfo[] {
    return HEALTH_APP_PLATFORMS;
  }

  getConnections(): HealthAppConnection[] {
    return Array.from(this.connections.values());
  }

  getConnection(connectionId: string): HealthAppConnection | undefined {
    return this.connections.get(connectionId);
  }

  initiateConnection(platform: HealthAppPlatform, username: string): HealthAppConnection {
    const platformInfo = HEALTH_APP_PLATFORMS.find(p => p.platform === platform);
    if (!platformInfo) throw new Error(`Unsupported health app: ${platform}`);

    const connection: HealthAppConnection = {
      id: `app_${platform}_${crypto.randomUUID().substring(0, 8)}`,
      platform,
      displayName: platformInfo.displayName,
      username,
      status: 'pending_auth',
      authMethod: platformInfo.authMethod,
      lastSync: null,
      connectedAt: null,
      dataTypes: [],
      recordCount: 0,
      syncFrequency: 'daily'
    };

    this.connections.set(connection.id, connection);
    console.log(`[HIPAA-AUDIT][HealthAppConnectors] Connection initiated - Platform: ${platform}, User: ${username}`);
    return connection;
  }

  syncConnection(connectionId: string): HealthAppSyncResult {
    const connection = this.connections.get(connectionId);
    if (!connection) throw new Error(`Connection not found: ${connectionId}`);
    if (connection.status !== 'connected') throw new Error(`Connection is not active: ${connection.status}`);

    const platformInfo = HEALTH_APP_PLATFORMS.find(p => p.platform === connection.platform);
    const newRecords = Math.floor(Math.random() * 20) + 5;
    const updatedRecords = Math.floor(Math.random() * 5) + 1;

    const result: HealthAppSyncResult = {
      syncId: `sync_${crypto.randomUUID().substring(0, 8)}`,
      connectionId,
      platform: connection.platform,
      status: 'completed',
      recordsSynced: newRecords + updatedRecords,
      newRecords,
      updatedRecords,
      errors: [],
      syncedDataTypes: platformInfo?.supportedDataTypes || connection.dataTypes,
      duration: Math.floor(Math.random() * 2000) + 800,
      syncedAt: new Date().toISOString()
    };

    connection.lastSync = result.syncedAt;
    connection.recordCount += newRecords;

    const existing = this.syncResults.get(connectionId) || [];
    existing.push(result);
    this.syncResults.set(connectionId, existing);

    console.log(`[HIPAA-AUDIT][HealthAppConnectors] Sync completed - Connection: ${connectionId}, Platform: ${connection.platform}, Records: ${result.recordsSynced}`);
    return result;
  }

  getNutritionData(connectionId: string): DailyNutritionSummary[] {
    return this.nutritionData.get(connectionId) || [];
  }

  getWorkoutData(connectionId: string): HealthAppDataPoint[] {
    return (this.dataPoints.get(connectionId) || []).filter(p =>
      ['workouts', 'running', 'cycling'].includes(p.dataType)
    );
  }

  getDashboard() {
    const connections = this.getConnections();
    return {
      totalPlatforms: HEALTH_APP_PLATFORMS.length,
      activeConnections: connections.filter(c => c.status === 'connected').length,
      totalConnections: connections.length,
      totalRecords: connections.reduce((sum, c) => sum + c.recordCount, 0),
      platforms: HEALTH_APP_PLATFORMS.map(p => ({
        ...p,
        connectionCount: connections.filter(c => c.platform === p.platform).length,
        activeCount: connections.filter(c => c.platform === p.platform && c.status === 'connected').length
      })),
      connections,
      nutritionSources: connections.filter(c => c.dataTypes.includes('nutrition')).length,
      fitnessSources: connections.filter(c => c.dataTypes.includes('workouts') || c.dataTypes.includes('running')).length
    };
  }

  getSyncHistory(connectionId: string): HealthAppSyncResult[] {
    return this.syncResults.get(connectionId) || [];
  }
}

export const healthAppConnectorService = new HealthAppConnectorService();
