import OpenAI from "openai";
let openai: OpenAI | null = null;
try {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} catch (error) {
  console.log("[IoTHealthSensor] OpenAI client not initialized - AI features will use fallback");
}

export type SensorType = 
  | "blood_pressure" 
  | "glucose_meter" 
  | "pulse_oximeter" 
  | "weight_scale" 
  | "thermometer" 
  | "heart_rate_monitor" 
  | "ecg_monitor"
  | "sleep_tracker";

export type SensorStatus = "connected" | "disconnected" | "syncing" | "low_battery" | "error";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertStatus = "active" | "acknowledged" | "resolved" | "escalated";

export interface IoTSensor {
  id: string;
  patientId: string;
  type: SensorType;
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  status: SensorStatus;
  batteryLevel: number;
  lastSync: string;
  lastReading: string | null;
  connectionProtocol: "bluetooth" | "wifi" | "cellular" | "zigbee";
  calibrationDate: string;
  nextCalibrationDue: string;
}

export interface SensorReading {
  id: string;
  sensorId: string;
  patientId: string;
  sensorType: SensorType;
  timestamp: string;
  values: Record<string, number>;
  unit: string;
  quality: "excellent" | "good" | "fair" | "poor";
  isAnomalous: boolean;
  anomalyScore?: number;
  anomalyReason?: string;
  context?: {
    activity?: string;
    mealStatus?: string;
    medication?: string;
    notes?: string;
  };
}

export interface BloodPressureReading extends SensorReading {
  sensorType: "blood_pressure";
  values: {
    systolic: number;
    diastolic: number;
    pulse: number;
    map?: number;
  };
}

export interface GlucoseReading extends SensorReading {
  sensorType: "glucose_meter";
  values: {
    glucose: number;
    trend?: number;
  };
}

export interface PulseOximeterReading extends SensorReading {
  sensorType: "pulse_oximeter";
  values: {
    spO2: number;
    pulseRate: number;
    perfusionIndex?: number;
  };
}

export interface WeightReading extends SensorReading {
  sensorType: "weight_scale";
  values: {
    weight: number;
    bmi?: number;
    bodyFat?: number;
    muscleMass?: number;
    waterPercentage?: number;
  };
}

export interface TemperatureReading extends SensorReading {
  sensorType: "thermometer";
  values: {
    temperature: number;
  };
}

export interface SensorAlert {
  id: string;
  patientId: string;
  sensorId: string;
  sensorType: SensorType;
  readingId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  recommendedAction: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  escalatedTo?: string;
  aiAnalysis?: string;
  noCdsDisclaimer: string;
}

export interface AnomalyDetectionResult {
  isAnomalous: boolean;
  anomalyScore: number;
  anomalyType?: string;
  reason?: string;
  severity?: AlertSeverity;
  recommendedAction?: string;
  aiInsights?: string;
  noCdsDisclaimer: string;
}

export interface SensorTrendAnalysis {
  sensorType: SensorType;
  period: string;
  dataPoints: number;
  trend: "improving" | "stable" | "declining" | "volatile";
  average: number;
  min: number;
  max: number;
  standardDeviation: number;
  anomalyCount: number;
  percentInRange: number;
  aiInsights: string;
  recommendations: string[];
  forecast?: {
    nextDay: number;
    confidence: number;
  };
  noCdsDisclaimer: string;
}

export interface RealTimeStream {
  id: string;
  patientId: string;
  sensorId: string;
  sensorType: SensorType;
  isActive: boolean;
  startedAt: string;
  lastDataAt: string;
  dataFrequency: number;
  bufferSize: number;
  readings: SensorReading[];
}

export interface SensorDashboardData {
  sensors: IoTSensor[];
  recentReadings: SensorReading[];
  activeAlerts: SensorAlert[];
  streamingStatus: { sensorId: string; isStreaming: boolean }[];
  summary: {
    totalSensors: number;
    connectedSensors: number;
    lowBatterySensors: number;
    readingsToday: number;
    alertsToday: number;
    criticalAlerts: number;
  };
  noCdsDisclaimer: string;
}

const NORMAL_RANGES: Record<SensorType, Record<string, { min: number; max: number; criticalMin?: number; criticalMax?: number }>> = {
  blood_pressure: {
    systolic: { min: 90, max: 140, criticalMin: 70, criticalMax: 180 },
    diastolic: { min: 60, max: 90, criticalMin: 40, criticalMax: 120 },
    pulse: { min: 60, max: 100, criticalMin: 40, criticalMax: 150 }
  },
  glucose_meter: {
    glucose: { min: 70, max: 140, criticalMin: 54, criticalMax: 250 }
  },
  pulse_oximeter: {
    spO2: { min: 95, max: 100, criticalMin: 90, criticalMax: 100 },
    pulseRate: { min: 60, max: 100, criticalMin: 40, criticalMax: 150 }
  },
  weight_scale: {
    bmi: { min: 18.5, max: 25, criticalMin: 16, criticalMax: 40 }
  },
  thermometer: {
    temperature: { min: 97.0, max: 99.5, criticalMin: 95.0, criticalMax: 103.0 }
  },
  heart_rate_monitor: {
    heartRate: { min: 60, max: 100, criticalMin: 40, criticalMax: 150 }
  },
  ecg_monitor: {
    heartRate: { min: 60, max: 100, criticalMin: 40, criticalMax: 150 }
  },
  sleep_tracker: {
    sleepDuration: { min: 420, max: 540 }
  }
};

class IoTHealthSensorService {
  private sensors: Map<string, IoTSensor[]> = new Map();
  private readings: Map<string, SensorReading[]> = new Map();
  private alerts: Map<string, SensorAlert[]> = new Map();
  private streams: Map<string, RealTimeStream> = new Map();
  private readingBuffer: Map<string, SensorReading[]> = new Map();

  constructor() {
    this.initializeSampleData();
    this.startRealTimeSimulation();
    console.log("[IoTHealthSensor] Service initialized with AI anomaly detection");
    console.log("[IoTHealthSensor] Supported sensors: blood_pressure, glucose_meter, pulse_oximeter, weight_scale, thermometer, heart_rate_monitor, ecg_monitor, sleep_tracker");
    console.log("[IoTHealthSensor] NO-CDS compliance enabled for all outputs");
  }

  private initializeSampleData(): void {
    const patientId = "patient-001";
    
    const sensors: IoTSensor[] = [
      {
        id: "sensor-bp-001",
        patientId,
        type: "blood_pressure",
        name: "Smart Blood Pressure Monitor",
        manufacturer: "Omron",
        model: "Evolv HEM-7600T",
        serialNumber: "BP-2024-001",
        firmwareVersion: "3.2.1",
        status: "connected",
        batteryLevel: 85,
        lastSync: new Date().toISOString(),
        lastReading: new Date().toISOString(),
        connectionProtocol: "bluetooth",
        calibrationDate: "2024-01-15",
        nextCalibrationDue: "2025-01-15"
      },
      {
        id: "sensor-glucose-001",
        patientId,
        type: "glucose_meter",
        name: "Continuous Glucose Monitor",
        manufacturer: "Dexcom",
        model: "G7",
        serialNumber: "CGM-2024-001",
        firmwareVersion: "2.5.0",
        status: "connected",
        batteryLevel: 72,
        lastSync: new Date().toISOString(),
        lastReading: new Date().toISOString(),
        connectionProtocol: "bluetooth",
        calibrationDate: "2024-02-01",
        nextCalibrationDue: "2024-02-15"
      },
      {
        id: "sensor-oximeter-001",
        patientId,
        type: "pulse_oximeter",
        name: "Pulse Oximeter Pro",
        manufacturer: "Masimo",
        model: "MightySat Rx",
        serialNumber: "OX-2024-001",
        firmwareVersion: "4.1.0",
        status: "connected",
        batteryLevel: 95,
        lastSync: new Date().toISOString(),
        lastReading: new Date().toISOString(),
        connectionProtocol: "bluetooth",
        calibrationDate: "2024-01-20",
        nextCalibrationDue: "2025-01-20"
      },
      {
        id: "sensor-scale-001",
        patientId,
        type: "weight_scale",
        name: "Smart Body Composition Scale",
        manufacturer: "Withings",
        model: "Body+",
        serialNumber: "SC-2024-001",
        firmwareVersion: "2.8.3",
        status: "connected",
        batteryLevel: 88,
        lastSync: new Date(Date.now() - 3600000).toISOString(),
        lastReading: new Date(Date.now() - 3600000).toISOString(),
        connectionProtocol: "wifi",
        calibrationDate: "2024-01-01",
        nextCalibrationDue: "2025-01-01"
      },
      {
        id: "sensor-temp-001",
        patientId,
        type: "thermometer",
        name: "Smart Thermometer",
        manufacturer: "Kinsa",
        model: "QuickCare",
        serialNumber: "TH-2024-001",
        firmwareVersion: "1.4.2",
        status: "connected",
        batteryLevel: 65,
        lastSync: new Date(Date.now() - 7200000).toISOString(),
        lastReading: new Date(Date.now() - 7200000).toISOString(),
        connectionProtocol: "bluetooth",
        calibrationDate: "2024-01-10",
        nextCalibrationDue: "2025-01-10"
      },
      {
        id: "sensor-ecg-001",
        patientId,
        type: "ecg_monitor",
        name: "Portable ECG Monitor",
        manufacturer: "AliveCor",
        model: "KardiaMobile 6L",
        serialNumber: "ECG-2024-001",
        firmwareVersion: "5.0.1",
        status: "low_battery",
        batteryLevel: 15,
        lastSync: new Date(Date.now() - 1800000).toISOString(),
        lastReading: new Date(Date.now() - 1800000).toISOString(),
        connectionProtocol: "bluetooth",
        calibrationDate: "2024-01-25",
        nextCalibrationDue: "2025-01-25"
      }
    ];

    this.sensors.set(patientId, sensors);

    const now = new Date();
    const readings: SensorReading[] = [];
    
    for (let i = 720; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 3600000);
      
      if (i % 8 === 0) {
        const systolic = 115 + Math.floor(Math.random() * 30) - 10;
        const diastolic = 75 + Math.floor(Math.random() * 20) - 8;
        const isAnomalous = systolic > 140 || systolic < 90 || diastolic > 90 || diastolic < 60;
        
        readings.push({
          id: `reading-bp-${i}`,
          sensorId: "sensor-bp-001",
          patientId,
          sensorType: "blood_pressure",
          timestamp: timestamp.toISOString(),
          values: {
            systolic,
            diastolic,
            pulse: 72 + Math.floor(Math.random() * 20) - 10,
            map: Math.round((diastolic * 2 + systolic) / 3)
          },
          unit: "mmHg",
          quality: "good",
          isAnomalous,
          anomalyScore: isAnomalous ? 0.7 + Math.random() * 0.3 : 0.1 + Math.random() * 0.2,
          anomalyReason: isAnomalous ? (systolic > 140 ? "Elevated systolic pressure" : "Blood pressure outside normal range") : undefined
        });
      }
      
      if (i % 4 === 0 || i < 24) {
        const glucose = 95 + Math.floor(Math.random() * 50) - 15;
        const isAnomalous = glucose > 140 || glucose < 70;
        
        readings.push({
          id: `reading-glucose-${i}`,
          sensorId: "sensor-glucose-001",
          patientId,
          sensorType: "glucose_meter",
          timestamp: timestamp.toISOString(),
          values: {
            glucose,
            trend: Math.random() > 0.5 ? 1 : -1
          },
          unit: "mg/dL",
          quality: "excellent",
          isAnomalous,
          anomalyScore: isAnomalous ? 0.75 + Math.random() * 0.25 : 0.05 + Math.random() * 0.15,
          anomalyReason: isAnomalous ? (glucose > 140 ? "Hyperglycemia detected" : "Hypoglycemia warning") : undefined,
          context: {
            mealStatus: ["fasting", "before_meal", "after_meal", "bedtime"][Math.floor(Math.random() * 4)]
          }
        });
      }
      
      if (i % 6 === 0) {
        const spO2 = 96 + Math.floor(Math.random() * 4);
        const pulseRate = 70 + Math.floor(Math.random() * 25) - 10;
        const isAnomalous = spO2 < 95;
        
        readings.push({
          id: `reading-spo2-${i}`,
          sensorId: "sensor-oximeter-001",
          patientId,
          sensorType: "pulse_oximeter",
          timestamp: timestamp.toISOString(),
          values: {
            spO2,
            pulseRate,
            perfusionIndex: 2 + Math.random() * 8
          },
          unit: "%",
          quality: "good",
          isAnomalous,
          anomalyScore: isAnomalous ? 0.8 : 0.1
        });
      }
      
      if (i % 24 === 0) {
        const weight = 175 + Math.random() * 5 - 2.5;
        readings.push({
          id: `reading-weight-${i}`,
          sensorId: "sensor-scale-001",
          patientId,
          sensorType: "weight_scale",
          timestamp: timestamp.toISOString(),
          values: {
            weight,
            bmi: weight / (1.78 * 1.78) * 0.453592,
            bodyFat: 22 + Math.random() * 4 - 2,
            muscleMass: 65 + Math.random() * 3 - 1.5,
            waterPercentage: 55 + Math.random() * 5 - 2.5
          },
          unit: "lbs",
          quality: "excellent",
          isAnomalous: false,
          anomalyScore: 0.05
        });
      }
    }

    this.readings.set(patientId, readings);

    const alertsList: SensorAlert[] = [
      {
        id: "alert-001",
        patientId,
        sensorId: "sensor-bp-001",
        sensorType: "blood_pressure",
        readingId: "reading-bp-8",
        severity: "high",
        status: "active",
        title: "Elevated Blood Pressure Detected",
        message: "Blood pressure reading of 155/95 mmHg is above normal range. Multiple elevated readings in past 24 hours.",
        recommendedAction: "Schedule follow-up with healthcare provider. Continue monitoring and avoid sodium-rich foods.",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        aiAnalysis: "Pattern analysis shows a 15% increase in average systolic pressure over the past week. This may indicate stress-related hypertension or medication adjustment needed.",
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This alert is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
      },
      {
        id: "alert-002",
        patientId,
        sensorId: "sensor-glucose-001",
        sensorType: "glucose_meter",
        readingId: "reading-glucose-4",
        severity: "medium",
        status: "acknowledged",
        title: "Post-Meal Glucose Spike",
        message: "Glucose level of 165 mg/dL detected 2 hours after meal, above target range of 140 mg/dL.",
        recommendedAction: "Review meal composition. Consider adjusting carbohydrate intake or medication timing.",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        acknowledgedAt: new Date(Date.now() - 5400000).toISOString(),
        acknowledgedBy: "patient-001",
        aiAnalysis: "Trend shows consistent post-meal spikes after high-carbohydrate meals. Pattern suggests meal timing optimization may help.",
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This alert is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
      },
      {
        id: "alert-003",
        patientId,
        sensorId: "sensor-ecg-001",
        sensorType: "ecg_monitor",
        readingId: "reading-ecg-1",
        severity: "low",
        status: "resolved",
        title: "Low Battery Warning",
        message: "ECG monitor battery at 15%. Please charge device to ensure continuous monitoring.",
        recommendedAction: "Charge the device within the next 2 hours.",
        createdAt: new Date(Date.now() - 10800000).toISOString(),
        resolvedAt: new Date(Date.now() - 1800000).toISOString(),
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This alert is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
      }
    ];

    this.alerts.set(patientId, alertsList);
  }

  private startRealTimeSimulation(): void {
    setInterval(() => {
      this.simulateRealTimeReadings();
    }, 30000);
  }

  private simulateRealTimeReadings(): void {
    const allStreams = Array.from(this.streams.entries());
    for (const [streamId, stream] of allStreams) {
      if (stream.isActive) {
        const patientId = stream.patientId;
        const reading = this.generateSimulatedReading(stream.sensorType, stream.sensorId, patientId);
        stream.readings.push(reading);
        stream.lastDataAt = new Date().toISOString();
        
        if (stream.readings.length > stream.bufferSize) {
          stream.readings.shift();
        }
        
        const patientReadings = this.readings.get(patientId) || [];
        patientReadings.push(reading);
        this.readings.set(patientId, patientReadings);
        
        if (reading.isAnomalous) {
          this.createAlertFromAnomaly(patientId, reading);
        }
      }
    }
  }

  private generateSimulatedReading(type: SensorType, sensorId: string, patientId: string): SensorReading {
    const now = new Date().toISOString();
    const id = `reading-${type}-${Date.now()}`;
    
    let values: Record<string, number> = {};
    let unit = "";
    let isAnomalous = false;
    let anomalyScore = 0.1;
    
    switch (type) {
      case "blood_pressure":
        const systolic = 115 + Math.floor(Math.random() * 30) - 10;
        const diastolic = 75 + Math.floor(Math.random() * 20) - 8;
        values = { systolic, diastolic, pulse: 72 + Math.floor(Math.random() * 20) - 10 };
        unit = "mmHg";
        isAnomalous = systolic > 140 || systolic < 90 || diastolic > 90;
        anomalyScore = isAnomalous ? 0.75 : 0.15;
        break;
      case "glucose_meter":
        const glucose = 95 + Math.floor(Math.random() * 50) - 15;
        values = { glucose, trend: Math.random() > 0.5 ? 1 : -1 };
        unit = "mg/dL";
        isAnomalous = glucose > 140 || glucose < 70;
        anomalyScore = isAnomalous ? 0.8 : 0.1;
        break;
      case "pulse_oximeter":
        const spO2 = 96 + Math.floor(Math.random() * 4);
        values = { spO2, pulseRate: 70 + Math.floor(Math.random() * 25) - 10 };
        unit = "%";
        isAnomalous = spO2 < 95;
        anomalyScore = isAnomalous ? 0.85 : 0.1;
        break;
      case "thermometer":
        const temp = 98.2 + Math.random() * 1.5 - 0.5;
        values = { temperature: Math.round(temp * 10) / 10 };
        unit = "°F";
        isAnomalous = temp > 100.4 || temp < 96.0;
        anomalyScore = isAnomalous ? 0.7 : 0.1;
        break;
      default:
        values = { value: 0 };
        unit = "";
    }
    
    return {
      id,
      sensorId,
      patientId,
      sensorType: type,
      timestamp: now,
      values,
      unit,
      quality: "good",
      isAnomalous,
      anomalyScore
    };
  }

  private async createAlertFromAnomaly(patientId: string, reading: SensorReading): Promise<void> {
    const alert: SensorAlert = {
      id: `alert-auto-${Date.now()}`,
      patientId,
      sensorId: reading.sensorId,
      sensorType: reading.sensorType,
      readingId: reading.id,
      severity: reading.anomalyScore && reading.anomalyScore > 0.85 ? "critical" : "high",
      status: "active",
      title: `Anomaly Detected: ${this.getSensorTypeName(reading.sensorType)}`,
      message: reading.anomalyReason || `Reading outside normal range: ${JSON.stringify(reading.values)}`,
      recommendedAction: "Review reading and consult healthcare provider if symptoms persist.",
      createdAt: new Date().toISOString(),
      noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This alert is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
    };
    
    const patientAlerts = this.alerts.get(patientId) || [];
    patientAlerts.unshift(alert);
    this.alerts.set(patientId, patientAlerts);
  }

  private getSensorTypeName(type: SensorType): string {
    const names: Record<SensorType, string> = {
      blood_pressure: "Blood Pressure",
      glucose_meter: "Blood Glucose",
      pulse_oximeter: "Oxygen Saturation",
      weight_scale: "Weight",
      thermometer: "Temperature",
      heart_rate_monitor: "Heart Rate",
      ecg_monitor: "ECG",
      sleep_tracker: "Sleep"
    };
    return names[type] || type;
  }

  async getSensors(patientId: string): Promise<IoTSensor[]> {
    console.log("[IoTHealthSensor] PHI access logged");
    return this.sensors.get(patientId) || [];
  }

  async registerSensor(patientId: string, sensor: Omit<IoTSensor, "id" | "patientId" | "lastSync" | "lastReading">): Promise<IoTSensor> {
    const newSensor: IoTSensor = {
      ...sensor,
      id: `sensor-${sensor.type}-${Date.now()}`,
      patientId,
      lastSync: new Date().toISOString(),
      lastReading: null
    };
    
    const patientSensors = this.sensors.get(patientId) || [];
    patientSensors.push(newSensor);
    this.sensors.set(patientId, patientSensors);
    
    console.log("[IoTHealthSensor] PHI access logged");
    
    return newSensor;
  }

  async disconnectSensor(patientId: string, sensorId: string): Promise<boolean> {
    const patientSensors = this.sensors.get(patientId) || [];
    const sensor = patientSensors.find(s => s.id === sensorId);
    
    if (sensor) {
      sensor.status = "disconnected";
      console.log("[IoTHealthSensor] PHI access logged");
      return true;
    }
    
    return false;
  }

  async syncSensor(patientId: string, sensorId: string): Promise<IoTSensor | null> {
    const patientSensors = this.sensors.get(patientId) || [];
    const sensor = patientSensors.find(s => s.id === sensorId);
    
    if (sensor) {
      sensor.status = "syncing";
      
      setTimeout(() => {
        sensor.status = "connected";
        sensor.lastSync = new Date().toISOString();
      }, 2000);
      
      console.log("[IoTHealthSensor] PHI access logged");
      return sensor;
    }
    
    return null;
  }

  async getReadings(
    patientId: string,
    options?: {
      sensorType?: SensorType;
      sensorId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      anomalousOnly?: boolean;
    }
  ): Promise<SensorReading[]> {
    let readings = this.readings.get(patientId) || [];
    
    if (options?.sensorType) {
      readings = readings.filter(r => r.sensorType === options.sensorType);
    }
    
    if (options?.sensorId) {
      readings = readings.filter(r => r.sensorId === options.sensorId);
    }
    
    if (options?.startDate) {
      readings = readings.filter(r => r.timestamp >= options.startDate!);
    }
    
    if (options?.endDate) {
      readings = readings.filter(r => r.timestamp <= options.endDate!);
    }
    
    if (options?.anomalousOnly) {
      readings = readings.filter(r => r.isAnomalous);
    }
    
    readings = readings.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (options?.limit) {
      readings = readings.slice(0, options.limit);
    }
    
    console.log("[IoTHealthSensor] PHI access logged");
    
    return readings;
  }

  async addReading(patientId: string, reading: Omit<SensorReading, "id" | "patientId" | "isAnomalous" | "anomalyScore">): Promise<SensorReading> {
    const anomalyResult = await this.detectAnomaly(reading.sensorType, reading.values);
    
    const newReading: SensorReading = {
      ...reading,
      id: `reading-${Date.now()}`,
      patientId,
      isAnomalous: anomalyResult.isAnomalous,
      anomalyScore: anomalyResult.anomalyScore,
      anomalyReason: anomalyResult.reason
    };
    
    const patientReadings = this.readings.get(patientId) || [];
    patientReadings.push(newReading);
    this.readings.set(patientId, patientReadings);
    
    const sensor = (this.sensors.get(patientId) || []).find(s => s.id === reading.sensorId);
    if (sensor) {
      sensor.lastReading = newReading.timestamp;
      sensor.lastSync = new Date().toISOString();
    }
    
    if (newReading.isAnomalous) {
      await this.createAlertFromAnomaly(patientId, newReading);
    }
    
    console.log("[IoTHealthSensor] PHI access logged");
    
    return newReading;
  }

  async detectAnomaly(sensorType: SensorType, values: Record<string, number>): Promise<AnomalyDetectionResult> {
    const ranges = NORMAL_RANGES[sensorType];
    let isAnomalous = false;
    let maxScore = 0;
    let anomalyReasons: string[] = [];
    let severity: AlertSeverity = "low";
    
    if (ranges) {
      for (const [key, range] of Object.entries(ranges)) {
        const value = values[key];
        if (value !== undefined) {
          if (range.criticalMin !== undefined && value < range.criticalMin) {
            isAnomalous = true;
            severity = "critical";
            maxScore = Math.max(maxScore, 0.95);
            anomalyReasons.push(`Critical low ${key}: ${value} (min: ${range.criticalMin})`);
          } else if (range.criticalMax !== undefined && value > range.criticalMax) {
            isAnomalous = true;
            severity = "critical";
            maxScore = Math.max(maxScore, 0.95);
            anomalyReasons.push(`Critical high ${key}: ${value} (max: ${range.criticalMax})`);
          } else if (value < range.min) {
            isAnomalous = true;
            severity = severity === "critical" ? "critical" : "high";
            maxScore = Math.max(maxScore, 0.7 + (range.min - value) / range.min * 0.2);
            anomalyReasons.push(`Low ${key}: ${value} (normal min: ${range.min})`);
          } else if (value > range.max) {
            isAnomalous = true;
            severity = severity === "critical" ? "critical" : "high";
            maxScore = Math.max(maxScore, 0.7 + (value - range.max) / range.max * 0.2);
            anomalyReasons.push(`High ${key}: ${value} (normal max: ${range.max})`);
          }
        }
      }
    }
    
    let aiInsights: string | undefined;
    
    if (isAnomalous && openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a health monitoring AI assistant. Provide brief, educational insights about health readings. Always emphasize that this is NOT medical advice and patients should consult their healthcare provider."
            },
            {
              role: "user",
              content: `Analyze this anomalous health reading:\nSensor Type: ${sensorType}\nValues: ${JSON.stringify(values)}\nAnomalies: ${anomalyReasons.join(", ")}\n\nProvide a brief educational insight (2-3 sentences) about what this might indicate and general wellness tips.`
            }
          ],
          max_tokens: 150
        });
        
        aiInsights = response.choices[0]?.message?.content || undefined;
      } catch (error) {
        console.error("[IoTHealthSensor] AI analysis error:", error);
      }
    }
    
    return {
      isAnomalous,
      anomalyScore: isAnomalous ? maxScore : 0.1 + Math.random() * 0.1,
      anomalyType: isAnomalous ? (severity === "critical" ? "critical_deviation" : "out_of_range") : undefined,
      reason: anomalyReasons.join("; "),
      severity: isAnomalous ? severity : undefined,
      recommendedAction: isAnomalous ? "Review reading and consult your healthcare provider" : undefined,
      aiInsights,
      noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This analysis is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
    };
  }

  async getAlerts(patientId: string, options?: { status?: AlertStatus; severity?: AlertSeverity; limit?: number }): Promise<SensorAlert[]> {
    let alerts = this.alerts.get(patientId) || [];
    
    if (options?.status) {
      alerts = alerts.filter(a => a.status === options.status);
    }
    
    if (options?.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }
    
    alerts = alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }
    
    console.log("[IoTHealthSensor] PHI access logged");
    
    return alerts;
  }

  async acknowledgeAlert(patientId: string, alertId: string, userId: string): Promise<SensorAlert | null> {
    const patientAlerts = this.alerts.get(patientId) || [];
    const alert = patientAlerts.find(a => a.id === alertId);
    
    if (alert && alert.status === "active") {
      alert.status = "acknowledged";
      alert.acknowledgedAt = new Date().toISOString();
      alert.acknowledgedBy = userId;
      
      console.log("[IoTHealthSensor] PHI access logged");
      
      return alert;
    }
    
    return null;
  }

  async resolveAlert(patientId: string, alertId: string, userId: string): Promise<SensorAlert | null> {
    const patientAlerts = this.alerts.get(patientId) || [];
    const alert = patientAlerts.find(a => a.id === alertId);
    
    if (alert && (alert.status === "active" || alert.status === "acknowledged")) {
      alert.status = "resolved";
      alert.resolvedAt = new Date().toISOString();
      alert.resolvedBy = userId;
      
      console.log("[IoTHealthSensor] PHI access logged");
      
      return alert;
    }
    
    return null;
  }

  async escalateAlert(patientId: string, alertId: string, escalateTo: string): Promise<SensorAlert | null> {
    const patientAlerts = this.alerts.get(patientId) || [];
    const alert = patientAlerts.find(a => a.id === alertId);
    
    if (alert) {
      alert.status = "escalated";
      alert.escalatedTo = escalateTo;
      
      console.log("[IoTHealthSensor] PHI access logged");
      
      return alert;
    }
    
    return null;
  }

  async startRealTimeStream(patientId: string, sensorId: string): Promise<RealTimeStream> {
    const sensor = (this.sensors.get(patientId) || []).find(s => s.id === sensorId);
    
    if (!sensor) {
      throw new Error("Sensor not found");
    }
    
    const streamId = `stream-${sensorId}-${Date.now()}`;
    const stream: RealTimeStream = {
      id: streamId,
      patientId,
      sensorId,
      sensorType: sensor.type,
      isActive: true,
      startedAt: new Date().toISOString(),
      lastDataAt: new Date().toISOString(),
      dataFrequency: 5000,
      bufferSize: 100,
      readings: []
    };
    
    this.streams.set(streamId, stream);
    
    console.log("[IoTHealthSensor] PHI access logged");
    
    return stream;
  }

  async stopRealTimeStream(streamId: string): Promise<boolean> {
    const stream = this.streams.get(streamId);
    
    if (stream) {
      stream.isActive = false;
      
      console.log("[IoTHealthSensor] PHI access logged");
      
      return true;
    }
    
    return false;
  }

  async getStreamData(streamId: string): Promise<RealTimeStream | null> {
    return this.streams.get(streamId) || null;
  }

  async getTrendAnalysis(patientId: string, sensorType: SensorType, days: number = 30): Promise<SensorTrendAnalysis> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const readings = await this.getReadings(patientId, { sensorType, startDate });
    
    if (readings.length === 0) {
      return {
        sensorType,
        period: `${days} days`,
        dataPoints: 0,
        trend: "stable",
        average: 0,
        min: 0,
        max: 0,
        standardDeviation: 0,
        anomalyCount: 0,
        percentInRange: 100,
        aiInsights: "No data available for analysis.",
        recommendations: [],
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This analysis is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
      };
    }
    
    const primaryKey = Object.keys(readings[0].values)[0];
    const values = readings.map(r => r.values[primaryKey]).filter(v => v !== undefined);
    
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    const anomalyCount = readings.filter(r => r.isAnomalous).length;
    
    const ranges = NORMAL_RANGES[sensorType]?.[primaryKey];
    const inRangeCount = ranges
      ? values.filter(v => v >= ranges.min && v <= ranges.max).length
      : values.length;
    const percentInRange = (inRangeCount / values.length) * 100;
    
    const recentValues = values.slice(0, Math.min(7, values.length));
    const olderValues = values.slice(Math.min(7, values.length));
    const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const olderAvg = olderValues.length > 0 ? olderValues.reduce((a, b) => a + b, 0) / olderValues.length : recentAvg;
    
    let trend: "improving" | "stable" | "declining" | "volatile" = "stable";
    const trendDiff = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (standardDeviation / average > 0.2) {
      trend = "volatile";
    } else if (Math.abs(trendDiff) > 10) {
      trend = trendDiff > 0 ? "declining" : "improving";
    }
    
    let aiInsights = "";
    let recommendations: string[] = [];
    
    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a health data analyst. Provide brief, educational insights about health trends. Always emphasize this is NOT medical advice."
            },
            {
              role: "user",
              content: `Analyze this ${this.getSensorTypeName(sensorType)} trend data:
Average: ${average.toFixed(1)}
Range: ${min.toFixed(1)} - ${max.toFixed(1)}
Trend: ${trend}
Anomaly rate: ${((anomalyCount / readings.length) * 100).toFixed(1)}%
% in normal range: ${percentInRange.toFixed(1)}%

Provide 2-3 sentences of insight and 2-3 brief recommendations.`
            }
          ],
          max_tokens: 200
        });
        
        const content = response.choices[0]?.message?.content || "";
        const parts = content.split("Recommendations:");
        aiInsights = parts[0]?.trim() || "Trend analysis complete.";
        if (parts[1]) {
          recommendations = parts[1].split(/[-•]/).filter(r => r.trim()).map(r => r.trim()).slice(0, 3);
        }
      } catch (error) {
        aiInsights = `Your ${this.getSensorTypeName(sensorType)} readings show a ${trend} trend with ${percentInRange.toFixed(0)}% of readings in normal range.`;
        recommendations = [
          "Continue regular monitoring",
          "Track any symptoms alongside readings",
          "Share trends with your healthcare provider"
        ];
      }
    } else {
      aiInsights = `Your ${this.getSensorTypeName(sensorType)} readings show a ${trend} trend over the past ${days} days. Average reading: ${average.toFixed(1)}, with ${percentInRange.toFixed(0)}% in normal range.`;
      recommendations = [
        "Continue regular monitoring",
        "Track any symptoms alongside readings",
        "Share trends with your healthcare provider"
      ];
    }
    
    console.log("[IoTHealthSensor] PHI access logged");
    
    return {
      sensorType,
      period: `${days} days`,
      dataPoints: readings.length,
      trend,
      average: Math.round(average * 10) / 10,
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      standardDeviation: Math.round(standardDeviation * 10) / 10,
      anomalyCount,
      percentInRange: Math.round(percentInRange * 10) / 10,
      aiInsights,
      recommendations,
      forecast: {
        nextDay: Math.round((recentAvg + (recentAvg - olderAvg) * 0.1) * 10) / 10,
        confidence: Math.max(0.5, 1 - standardDeviation / average)
      },
      noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This analysis is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
    };
  }

  async getDashboard(patientId: string): Promise<SensorDashboardData> {
    const sensors = await this.getSensors(patientId);
    const recentReadings = await this.getReadings(patientId, { limit: 50 });
    const activeAlerts = await this.getAlerts(patientId, { status: "active" });
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    const readingsToday = recentReadings.filter(r => r.timestamp >= today).length;
    const alertsToday = (await this.getAlerts(patientId)).filter(a => a.createdAt >= today).length;
    
    const allStreamValues = Array.from(this.streams.values());
    const streamingStatus = sensors.map(s => ({
      sensorId: s.id,
      isStreaming: allStreamValues.some(str => str.sensorId === s.id && str.isActive)
    }));
    
    console.log("[IoTHealthSensor] PHI access logged");
    
    return {
      sensors,
      recentReadings,
      activeAlerts,
      streamingStatus,
      summary: {
        totalSensors: sensors.length,
        connectedSensors: sensors.filter(s => s.status === "connected").length,
        lowBatterySensors: sensors.filter(s => s.batteryLevel < 20).length,
        readingsToday,
        alertsToday,
        criticalAlerts: activeAlerts.filter(a => a.severity === "critical").length
      },
      noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This dashboard is for informational purposes and NOT medical advice. Consult your healthcare provider for diagnosis and treatment."
    };
  }
}

export const iotHealthSensorService = new IoTHealthSensorService();
