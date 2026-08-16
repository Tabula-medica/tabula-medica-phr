import { generatePhiSafeText } from "./ai-gateway";
const aiEnabled = true;

export type QocaDeviceType =
  | "ecg_monitor"
  | "digital_stethoscope"
  | "vital_signs_hub"
  | "smart_patient_terminal"
  | "environmental_sensor"
  | "fall_detector"
  | "medication_dispenser"
  | "sleep_monitor";

export type QocaDeviceStatus = "online" | "offline" | "syncing" | "low_battery" | "maintenance" | "pairing";

export type QocaAlertPriority = "low" | "medium" | "high" | "critical";

export type QocaRegion = "asia_pacific" | "europe" | "north_america" | "south_america" | "middle_east" | "africa";

export interface QocaDevice {
  id: string;
  patientId: string;
  type: QocaDeviceType;
  name: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  status: QocaDeviceStatus;
  batteryLevel: number;
  lastSync: string;
  connectionProtocol: "bluetooth_le" | "wifi" | "cellular_5g" | "zigbee" | "lora";
  region: QocaRegion;
  locale: string;
  registeredAt: string;
  warrantyExpiry: string;
}

export interface QocaReading {
  id: string;
  deviceId: string;
  patientId: string;
  deviceType: QocaDeviceType;
  timestamp: string;
  values: Record<string, number | string>;
  unit: string;
  quality: "excellent" | "good" | "fair" | "poor";
  isAnomalous: boolean;
  anomalyScore?: number;
  anomalyDetail?: string;
  fhirResourceType?: string;
}

export interface QocaECGReading extends QocaReading {
  deviceType: "ecg_monitor";
  values: {
    heartRate: number;
    rhythm: string;
    prInterval: number;
    qrsWidth: number;
    qtInterval: number;
    stSegment: string;
  };
}

export interface QocaVitalSignsReading extends QocaReading {
  deviceType: "vital_signs_hub";
  values: {
    systolic: number;
    diastolic: number;
    pulse: number;
    spo2: number;
    temperature: number;
    respiratoryRate: number;
  };
}

export interface QocaEnvironmentalReading extends QocaReading {
  deviceType: "environmental_sensor";
  values: {
    temperature: number;
    humidity: number;
    airQuality: number;
    co2Level: number;
    noiseLevel: number;
  };
}

export interface QocaAlert {
  id: string;
  patientId: string;
  deviceId: string;
  type: string;
  priority: QocaAlertPriority;
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface QocaCareCoordinationEvent {
  id: string;
  patientId: string;
  eventType: "video_call" | "nurse_call" | "iv_alert" | "broadcast" | "education_push" | "remote_consultation";
  status: "pending" | "active" | "completed" | "cancelled";
  participants: string[];
  scheduledAt: string;
  completedAt?: string;
  notes?: string;
  locale: string;
}

export interface QocaDashboardSummary {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  alertsToday: number;
  criticalAlerts: number;
  readingsToday: number;
  devicesByType: Record<QocaDeviceType, number>;
  recentAlerts: QocaAlert[];
  recentReadings: QocaReading[];
  systemHealth: {
    uptime: number;
    dataLatency: number;
    syncSuccessRate: number;
    storageUsed: number;
  };
  regionalCoverage: Record<QocaRegion, number>;
}

const DEVICE_MODELS: Record<QocaDeviceType, { model: string; name: string }> = {
  ecg_monitor: { model: "QOCA abc", name: "QOCA Portable ECG Monitor" },
  digital_stethoscope: { model: "QOCA DSX", name: "QOCA Wireless Digital Stethoscope" },
  vital_signs_hub: { model: "QOCA VitalHub", name: "QOCA Vital Signs Hub" },
  smart_patient_terminal: { model: "QOCA spt", name: "QOCA Smart Patient Terminal" },
  environmental_sensor: { model: "QOCA EnvSense", name: "QOCA Environmental Monitor" },
  fall_detector: { model: "QOCA FallGuard", name: "QOCA Fall Detection Sensor" },
  medication_dispenser: { model: "QOCA MedDisp", name: "QOCA Smart Medication Dispenser" },
  sleep_monitor: { model: "QOCA SleepTrack", name: "QOCA Sleep Quality Monitor" },
};

const NORMAL_RANGES: Record<string, { min: number; max: number; critical_min: number; critical_max: number }> = {
  heartRate: { min: 60, max: 100, critical_min: 40, critical_max: 150 },
  systolic: { min: 90, max: 140, critical_min: 70, critical_max: 180 },
  diastolic: { min: 60, max: 90, critical_min: 40, critical_max: 120 },
  spo2: { min: 95, max: 100, critical_min: 88, critical_max: 100 },
  temperature: { min: 36.1, max: 37.2, critical_min: 35.0, critical_max: 39.5 },
  respiratoryRate: { min: 12, max: 20, critical_min: 8, critical_max: 30 },
  airQuality: { min: 0, max: 50, critical_min: 0, critical_max: 150 },
  co2Level: { min: 400, max: 1000, critical_min: 0, critical_max: 2000 },
};

const SUPPORTED_LOCALES = [
  "en", "es", "fr", "de", "it", "pt", "zh", "ja", "ko", "ar",
  "hi", "th", "vi", "id", "ms", "tl", "ru", "tr", "nl",
];

class QocaAIoTService {
  private devices: Map<string, QocaDevice> = new Map();
  private readings: QocaReading[] = [];
  private alerts: QocaAlert[] = [];
  private careEvents: QocaCareCoordinationEvent[] = [];

  constructor() {
    this.initializeSampleData();
    console.log("[QOCAAIoT] Service initialized");
    console.log(`[QOCAAIoT] Device types: ${Object.keys(DEVICE_MODELS).length}`);
    console.log(`[QOCAAIoT] Supported locales: ${SUPPORTED_LOCALES.length}`);
    console.log(`[QOCAAIoT] Features: ECG monitoring, vital signs, environmental sensing, fall detection, care coordination`);
    console.log(`[QOCAAIoT] NO-CDS compliance enabled for all AI outputs`);
  }

  private initializeSampleData(): void {
    const now = new Date();
    const sampleDevices: QocaDevice[] = [
      {
        id: "qoca-dev-001",
        patientId: "sample-patient",
        type: "ecg_monitor",
        name: "QOCA Portable ECG Monitor",
        model: "QOCA abc",
        serialNumber: "QA-ECG-2025-001",
        firmwareVersion: "3.2.1",
        status: "online",
        batteryLevel: 87,
        lastSync: new Date(now.getTime() - 5 * 60000).toISOString(),
        connectionProtocol: "bluetooth_le",
        region: "asia_pacific",
        locale: "zh",
        registeredAt: new Date(now.getTime() - 90 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 275 * 86400000).toISOString(),
      },
      {
        id: "qoca-dev-002",
        patientId: "sample-patient",
        type: "vital_signs_hub",
        name: "QOCA Vital Signs Hub",
        model: "QOCA VitalHub",
        serialNumber: "QA-VSH-2025-002",
        firmwareVersion: "2.8.0",
        status: "online",
        batteryLevel: 100,
        lastSync: new Date(now.getTime() - 2 * 60000).toISOString(),
        connectionProtocol: "wifi",
        region: "europe",
        locale: "de",
        registeredAt: new Date(now.getTime() - 60 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 305 * 86400000).toISOString(),
      },
      {
        id: "qoca-dev-003",
        patientId: "sample-patient",
        type: "environmental_sensor",
        name: "QOCA Environmental Monitor",
        model: "QOCA EnvSense",
        serialNumber: "QA-ENV-2025-003",
        firmwareVersion: "1.5.4",
        status: "online",
        batteryLevel: 72,
        lastSync: new Date(now.getTime() - 1 * 60000).toISOString(),
        connectionProtocol: "zigbee",
        region: "north_america",
        locale: "en",
        registeredAt: new Date(now.getTime() - 45 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 320 * 86400000).toISOString(),
      },
      {
        id: "qoca-dev-004",
        patientId: "sample-patient",
        type: "fall_detector",
        name: "QOCA Fall Detection Sensor",
        model: "QOCA FallGuard",
        serialNumber: "QA-FD-2025-004",
        firmwareVersion: "2.1.0",
        status: "online",
        batteryLevel: 65,
        lastSync: new Date(now.getTime() - 3 * 60000).toISOString(),
        connectionProtocol: "bluetooth_le",
        region: "asia_pacific",
        locale: "ja",
        registeredAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 335 * 86400000).toISOString(),
      },
      {
        id: "qoca-dev-005",
        patientId: "sample-patient",
        type: "smart_patient_terminal",
        name: "QOCA Smart Patient Terminal",
        model: "QOCA spt",
        serialNumber: "QA-SPT-2025-005",
        firmwareVersion: "4.0.2",
        status: "online",
        batteryLevel: 100,
        lastSync: new Date(now.getTime() - 30000).toISOString(),
        connectionProtocol: "wifi",
        region: "asia_pacific",
        locale: "ko",
        registeredAt: new Date(now.getTime() - 120 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 245 * 86400000).toISOString(),
      },
      {
        id: "qoca-dev-006",
        patientId: "sample-patient",
        type: "digital_stethoscope",
        name: "QOCA Wireless Digital Stethoscope",
        model: "QOCA DSX",
        serialNumber: "QA-DSX-2025-006",
        firmwareVersion: "1.9.3",
        status: "offline",
        batteryLevel: 15,
        lastSync: new Date(now.getTime() - 48 * 3600000).toISOString(),
        connectionProtocol: "bluetooth_le",
        region: "south_america",
        locale: "pt",
        registeredAt: new Date(now.getTime() - 75 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 290 * 86400000).toISOString(),
      },
      {
        id: "qoca-dev-007",
        patientId: "sample-patient",
        type: "medication_dispenser",
        name: "QOCA Smart Medication Dispenser",
        model: "QOCA MedDisp",
        serialNumber: "QA-MD-2025-007",
        firmwareVersion: "2.3.1",
        status: "online",
        batteryLevel: 93,
        lastSync: new Date(now.getTime() - 10 * 60000).toISOString(),
        connectionProtocol: "wifi",
        region: "middle_east",
        locale: "ar",
        registeredAt: new Date(now.getTime() - 50 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 315 * 86400000).toISOString(),
      },
      {
        id: "qoca-dev-008",
        patientId: "sample-patient",
        type: "sleep_monitor",
        name: "QOCA Sleep Quality Monitor",
        model: "QOCA SleepTrack",
        serialNumber: "QA-SL-2025-008",
        firmwareVersion: "1.7.0",
        status: "online",
        batteryLevel: 54,
        lastSync: new Date(now.getTime() - 8 * 3600000).toISOString(),
        connectionProtocol: "bluetooth_le",
        region: "africa",
        locale: "fr",
        registeredAt: new Date(now.getTime() - 20 * 86400000).toISOString(),
        warrantyExpiry: new Date(now.getTime() + 345 * 86400000).toISOString(),
      },
    ];

    for (const device of sampleDevices) {
      this.devices.set(device.id, device);
    }

    this.generateSampleReadings();
    this.generateSampleAlerts();
    this.generateSampleCareEvents();
  }

  private generateSampleReadings(): void {
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - i * 3600000).toISOString();
      this.readings.push({
        id: `qoca-reading-ecg-${i}`,
        deviceId: "qoca-dev-001",
        patientId: "sample-patient",
        deviceType: "ecg_monitor",
        timestamp,
        values: {
          heartRate: 65 + Math.floor(Math.random() * 25),
          rhythm: "Normal Sinus",
          prInterval: 140 + Math.floor(Math.random() * 40),
          qrsWidth: 80 + Math.floor(Math.random() * 30),
          qtInterval: 350 + Math.floor(Math.random() * 60),
          stSegment: "Normal",
        },
        unit: "bpm",
        quality: "excellent",
        isAnomalous: false,
        fhirResourceType: "Observation",
      });

      this.readings.push({
        id: `qoca-reading-vitals-${i}`,
        deviceId: "qoca-dev-002",
        patientId: "sample-patient",
        deviceType: "vital_signs_hub",
        timestamp,
        values: {
          systolic: 110 + Math.floor(Math.random() * 20),
          diastolic: 70 + Math.floor(Math.random() * 15),
          pulse: 65 + Math.floor(Math.random() * 20),
          spo2: 96 + Math.floor(Math.random() * 4),
          temperature: 36.2 + Math.random() * 0.8,
          respiratoryRate: 14 + Math.floor(Math.random() * 6),
        },
        unit: "mmHg",
        quality: "good",
        isAnomalous: false,
        fhirResourceType: "Observation",
      });

      this.readings.push({
        id: `qoca-reading-env-${i}`,
        deviceId: "qoca-dev-003",
        patientId: "sample-patient",
        deviceType: "environmental_sensor",
        timestamp,
        values: {
          temperature: 21 + Math.random() * 3,
          humidity: 40 + Math.floor(Math.random() * 20),
          airQuality: 20 + Math.floor(Math.random() * 30),
          co2Level: 450 + Math.floor(Math.random() * 200),
          noiseLevel: 30 + Math.floor(Math.random() * 25),
        },
        unit: "AQI",
        quality: "excellent",
        isAnomalous: false,
      });
    }
  }

  private generateSampleAlerts(): void {
    const now = new Date();
    this.alerts = [
      {
        id: "qoca-alert-001",
        patientId: "sample-patient",
        deviceId: "qoca-dev-001",
        type: "heart_rate_elevated",
        priority: "medium",
        title: "Heart Rate Elevated",
        message: "Heart rate reading of 112 bpm detected. This is above the normal range. For informational purposes only.",
        timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
        acknowledged: false,
      },
      {
        id: "qoca-alert-002",
        patientId: "sample-patient",
        deviceId: "qoca-dev-006",
        type: "device_battery_low",
        priority: "low",
        title: "Low Battery",
        message: "QOCA Digital Stethoscope battery at 15%. Please charge the device.",
        timestamp: new Date(now.getTime() - 4 * 3600000).toISOString(),
        acknowledged: false,
      },
      {
        id: "qoca-alert-003",
        patientId: "sample-patient",
        deviceId: "qoca-dev-004",
        type: "fall_detected",
        priority: "critical",
        title: "Possible Fall Detected",
        message: "The fall detection sensor detected a sudden impact event. Emergency contacts have been notified.",
        timestamp: new Date(now.getTime() - 24 * 3600000).toISOString(),
        acknowledged: true,
        acknowledgedBy: "Dr. Chen",
        acknowledgedAt: new Date(now.getTime() - 23.5 * 3600000).toISOString(),
      },
      {
        id: "qoca-alert-004",
        patientId: "sample-patient",
        deviceId: "qoca-dev-007",
        type: "medication_missed",
        priority: "high",
        title: "Medication Dose Missed",
        message: "Scheduled medication dose was not dispensed at the expected time. Please verify.",
        timestamp: new Date(now.getTime() - 6 * 3600000).toISOString(),
        acknowledged: false,
      },
    ];
  }

  private generateSampleCareEvents(): void {
    const now = new Date();
    this.careEvents = [
      {
        id: "qoca-care-001",
        patientId: "sample-patient",
        eventType: "video_call",
        status: "completed",
        participants: ["Dr. Chen", "Patient"],
        scheduledAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
        completedAt: new Date(now.getTime() - 2 * 86400000 + 1800000).toISOString(),
        notes: "Follow-up on ECG readings. All normal.",
        locale: "zh",
      },
      {
        id: "qoca-care-002",
        patientId: "sample-patient",
        eventType: "remote_consultation",
        status: "pending",
        participants: ["Dr. Muller", "Patient"],
        scheduledAt: new Date(now.getTime() + 86400000).toISOString(),
        locale: "de",
      },
      {
        id: "qoca-care-003",
        patientId: "sample-patient",
        eventType: "education_push",
        status: "completed",
        participants: ["System", "Patient"],
        scheduledAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
        completedAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
        notes: "Sent heart health education content in patient's preferred language.",
        locale: "en",
      },
    ];
  }

  async getDevices(patientId: string): Promise<QocaDevice[]> {
    return Array.from(this.devices.values()).filter(d => d.patientId === patientId);
  }

  async getDevice(deviceId: string): Promise<QocaDevice | undefined> {
    return this.devices.get(deviceId);
  }

  async registerDevice(device: Omit<QocaDevice, "id" | "registeredAt" | "warrantyExpiry">): Promise<QocaDevice> {
    const id = `qoca-dev-${Date.now()}`;
    const now = new Date();
    const newDevice: QocaDevice = {
      ...device,
      id,
      registeredAt: now.toISOString(),
      warrantyExpiry: new Date(now.getTime() + 365 * 86400000).toISOString(),
    };
    this.devices.set(id, newDevice);
    return newDevice;
  }

  async updateDeviceStatus(deviceId: string, status: QocaDeviceStatus): Promise<QocaDevice | undefined> {
    const device = this.devices.get(deviceId);
    if (device) {
      device.status = status;
      device.lastSync = new Date().toISOString();
      return device;
    }
    return undefined;
  }

  async getReadings(deviceId: string, limit = 24): Promise<QocaReading[]> {
    return this.readings
      .filter(r => r.deviceId === deviceId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async getReadingsByPatient(patientId: string, deviceType?: QocaDeviceType, limit = 50): Promise<QocaReading[]> {
    let filtered = this.readings.filter(r => r.patientId === patientId);
    if (deviceType) {
      filtered = filtered.filter(r => r.deviceType === deviceType);
    }
    return filtered
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async addReading(reading: Omit<QocaReading, "id" | "isAnomalous" | "anomalyScore" | "anomalyDetail">): Promise<QocaReading> {
    const id = `qoca-reading-${Date.now()}`;
    const anomalyResult = this.detectAnomaly(reading.values);
    const newReading: QocaReading = {
      ...reading,
      id,
      isAnomalous: anomalyResult.isAnomalous,
      anomalyScore: anomalyResult.score,
      anomalyDetail: anomalyResult.detail,
    };
    this.readings.push(newReading);

    if (anomalyResult.isAnomalous) {
      await this.createAlert({
        patientId: reading.patientId,
        deviceId: reading.deviceId,
        type: "anomalous_reading",
        priority: anomalyResult.score > 0.8 ? "critical" : "high",
        title: "Anomalous Reading Detected",
        message: `${anomalyResult.detail} This is for informational purposes only — not a clinical recommendation.`,
      });
    }

    return newReading;
  }

  private detectAnomaly(values: Record<string, number | string>): { isAnomalous: boolean; score: number; detail?: string } {
    for (const [key, val] of Object.entries(values)) {
      if (typeof val !== "number") continue;
      const range = NORMAL_RANGES[key];
      if (!range) continue;
      if (val < range.critical_min || val > range.critical_max) {
        return {
          isAnomalous: true,
          score: 0.9,
          detail: `${key} reading of ${val} is outside critical range (${range.critical_min}-${range.critical_max}).`,
        };
      }
      if (val < range.min || val > range.max) {
        return {
          isAnomalous: true,
          score: 0.6,
          detail: `${key} reading of ${val} is outside normal range (${range.min}-${range.max}).`,
        };
      }
    }
    return { isAnomalous: false, score: 0 };
  }

  async getAlerts(patientId: string, acknowledged?: boolean): Promise<QocaAlert[]> {
    let filtered = this.alerts.filter(a => a.patientId === patientId);
    if (acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === acknowledged);
    }
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createAlert(alert: Omit<QocaAlert, "id" | "timestamp" | "acknowledged">): Promise<QocaAlert> {
    const newAlert: QocaAlert = {
      ...alert,
      id: `qoca-alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };
    this.alerts.push(newAlert);
    return newAlert;
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<QocaAlert | undefined> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date().toISOString();
      return alert;
    }
    return undefined;
  }

  async getCareEvents(patientId: string): Promise<QocaCareCoordinationEvent[]> {
    return this.careEvents
      .filter(e => e.patientId === patientId)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }

  async getDashboardSummary(patientId: string): Promise<QocaDashboardSummary> {
    const devices = await this.getDevices(patientId);
    const alerts = await this.getAlerts(patientId);
    const readings = await this.getReadingsByPatient(patientId);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const devicesByType: Record<string, number> = {};
    const regionalCoverage: Record<string, number> = {};
    let onlineCount = 0;
    let offlineCount = 0;

    for (const d of devices) {
      devicesByType[d.type] = (devicesByType[d.type] || 0) + 1;
      regionalCoverage[d.region] = (regionalCoverage[d.region] || 0) + 1;
      if (d.status === "online" || d.status === "syncing") onlineCount++;
      else offlineCount++;
    }

    const alertsToday = alerts.filter(a => new Date(a.timestamp).getTime() >= todayStart);
    const readingsToday = readings.filter(r => new Date(r.timestamp).getTime() >= todayStart);

    return {
      totalDevices: devices.length,
      onlineDevices: onlineCount,
      offlineDevices: offlineCount,
      alertsToday: alertsToday.length,
      criticalAlerts: alertsToday.filter(a => a.priority === "critical").length,
      readingsToday: readingsToday.length,
      devicesByType: devicesByType as Record<QocaDeviceType, number>,
      recentAlerts: alerts.slice(0, 5),
      recentReadings: readings.slice(0, 10),
      systemHealth: {
        uptime: 99.7,
        dataLatency: 120,
        syncSuccessRate: 98.5,
        storageUsed: 2.4,
      },
      regionalCoverage: regionalCoverage as Record<QocaRegion, number>,
    };
  }

  async getAIHealthInsight(patientId: string, locale: string): Promise<{ insight: string; disclaimer: string }> {
    const readings = await this.getReadingsByPatient(patientId, undefined, 20);
    const devices = await this.getDevices(patientId);

    if (!aiEnabled) {
      return {
        insight: this.generateFallbackInsight(readings, devices, locale),
        disclaimer: "NOT CLINICAL ADVICE — This AI-generated summary is for informational purposes only. Always consult your healthcare provider for medical decisions.",
      };
    }

    try {
      const readingSummary = readings.slice(0, 10).map(r => ({
        type: r.deviceType,
        values: r.values,
        timestamp: r.timestamp,
        anomalous: r.isAnomalous,
      }));

      const insightText = await generatePhiSafeText({
        system: `You are a health data summarizer for QOCA AIoT devices. Provide a brief, patient-friendly summary of recent health readings from IoT devices. CRITICAL: This is NOT clinical decision support. Output must be informational only. Never diagnose, prescribe, or recommend treatments. Respond in the language matching locale: ${locale}. Keep response under 200 words.`,
        user: `Summarize these recent QOCA AIoT device readings for the patient:\n${JSON.stringify(readingSummary, null, 2)}`,
        maxTokens: 300,
      });

      return {
        insight: insightText || this.generateFallbackInsight(readings, devices, locale),
        disclaimer: "NOT CLINICAL ADVICE — This AI-generated summary is for informational purposes only. Always consult your healthcare provider for medical decisions.",
      };
    } catch {
      return {
        insight: this.generateFallbackInsight(readings, devices, locale),
        disclaimer: "NOT CLINICAL ADVICE — This AI-generated summary is for informational purposes only. Always consult your healthcare provider for medical decisions.",
      };
    }
  }

  private generateFallbackInsight(readings: QocaReading[], devices: QocaDevice[], _locale: string): string {
    const activeDevices = devices.filter(d => d.status === "online").length;
    const anomalousReadings = readings.filter(r => r.isAnomalous).length;
    const ecgReadings = readings.filter(r => r.deviceType === "ecg_monitor");
    const avgHR = ecgReadings.length > 0
      ? Math.round(ecgReadings.reduce((sum, r) => sum + (typeof r.values.heartRate === "number" ? r.values.heartRate : 0), 0) / ecgReadings.length)
      : 0;

    let summary = `Your QOCA AIoT system has ${activeDevices} active device(s) monitoring your health. `;
    if (avgHR > 0) {
      summary += `Your average heart rate over recent readings is ${avgHR} bpm. `;
    }
    if (anomalousReadings > 0) {
      summary += `${anomalousReadings} reading(s) were flagged for review. `;
    } else {
      summary += `All recent readings are within expected ranges. `;
    }
    summary += `Environmental conditions in your home are being continuously monitored for your comfort and safety.`;
    return summary;
  }

  getSupportedLocales(): string[] {
    return SUPPORTED_LOCALES;
  }

  getDeviceModels(): Record<QocaDeviceType, { model: string; name: string }> {
    return DEVICE_MODELS;
  }
}

export const qocaAIoTService = new QocaAIoTService();
