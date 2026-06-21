import type { Express } from "express";
import { iotHealthSensorService, type SensorType, type AlertStatus, type AlertSeverity } from "./services/iot-health-sensor-service";
import { z } from "zod";

const sensorTypeSchema = z.enum([
  "blood_pressure",
  "glucose_meter",
  "pulse_oximeter",
  "weight_scale",
  "thermometer",
  "heart_rate_monitor",
  "ecg_monitor",
  "sleep_tracker"
]);

const registerSensorSchema = z.object({
  type: sensorTypeSchema,
  name: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  serialNumber: z.string().min(1),
  firmwareVersion: z.string().min(1),
  status: z.enum(["connected", "disconnected", "syncing", "low_battery", "error"]).default("connected"),
  batteryLevel: z.number().min(0).max(100).default(100),
  connectionProtocol: z.enum(["bluetooth", "wifi", "cellular", "zigbee"]),
  calibrationDate: z.string(),
  nextCalibrationDue: z.string()
});

const addReadingSchema = z.object({
  sensorId: z.string().min(1),
  sensorType: sensorTypeSchema,
  values: z.record(z.number()),
  unit: z.string(),
  quality: z.enum(["excellent", "good", "fair", "poor"]).default("good"),
  context: z.object({
    activity: z.string().optional(),
    mealStatus: z.string().optional(),
    medication: z.string().optional(),
    notes: z.string().optional()
  }).optional()
});

const getReadingsSchema = z.object({
  sensorType: sensorTypeSchema.optional(),
  sensorId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  anomalousOnly: z.boolean().optional()
});

const alertActionSchema = z.object({
  alertId: z.string().min(1)
});

const escalateAlertSchema = z.object({
  alertId: z.string().min(1),
  escalateTo: z.string().min(1)
});

const streamActionSchema = z.object({
  sensorId: z.string().min(1)
});

const trendAnalysisSchema = z.object({
  sensorType: sensorTypeSchema,
  days: z.number().min(1).max(365).default(30)
});

export function registerIoTHealthSensorRoutes(app: Express): void {
  app.get("/api/iot-sensors/dashboard", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const dashboard = await iotHealthSensorService.getDashboard(patientId);
      res.json(dashboard);
    } catch (error) {
      console.error("[IoT Routes] Error getting dashboard:", error);
      res.status(500).json({ error: "Failed to get dashboard" });
    }
  });

  app.get("/api/iot-sensors/sensors", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const sensors = await iotHealthSensorService.getSensors(patientId);
      res.json({
        success: true,
        sensors,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Sensor data is for informational purposes only, NOT medical advice."
      });
    } catch (error) {
      console.error("[IoT Routes] Error getting sensors:", error);
      res.status(500).json({ error: "Failed to get sensors" });
    }
  });

  app.post("/api/iot-sensors/sensors/register", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const parsed = registerSensorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const sensor = await iotHealthSensorService.registerSensor(patientId, parsed.data);
      res.json({
        success: true,
        sensor,
        message: `Successfully registered ${sensor.name}`
      });
    } catch (error) {
      console.error("[IoT Routes] Error registering sensor:", error);
      res.status(500).json({ error: "Failed to register sensor" });
    }
  });

  app.post("/api/iot-sensors/sensors/:sensorId/disconnect", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const { sensorId } = req.params;
      
      const success = await iotHealthSensorService.disconnectSensor(patientId, sensorId);
      
      if (success) {
        res.json({ success: true, message: "Sensor disconnected" });
      } else {
        res.status(404).json({ error: "Sensor not found" });
      }
    } catch (error) {
      console.error("[IoT Routes] Error disconnecting sensor:", error);
      res.status(500).json({ error: "Failed to disconnect sensor" });
    }
  });

  app.post("/api/iot-sensors/sensors/:sensorId/sync", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const { sensorId } = req.params;
      
      const sensor = await iotHealthSensorService.syncSensor(patientId, sensorId);
      
      if (sensor) {
        res.json({ success: true, sensor, message: "Sync initiated" });
      } else {
        res.status(404).json({ error: "Sensor not found" });
      }
    } catch (error) {
      console.error("[IoT Routes] Error syncing sensor:", error);
      res.status(500).json({ error: "Failed to sync sensor" });
    }
  });

  app.get("/api/iot-sensors/readings", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const options = {
        sensorType: req.query.sensorType as SensorType | undefined,
        sensorId: req.query.sensorId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        anomalousOnly: req.query.anomalousOnly === "true"
      };
      
      const readings = await iotHealthSensorService.getReadings(patientId, options);
      res.json({
        success: true,
        readings,
        count: readings.length,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. These readings are for informational purposes only, NOT medical advice."
      });
    } catch (error) {
      console.error("[IoT Routes] Error getting readings:", error);
      res.status(500).json({ error: "Failed to get readings" });
    }
  });

  app.post("/api/iot-sensors/readings", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const parsed = addReadingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const reading = await iotHealthSensorService.addReading(patientId, {
        ...parsed.data,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        reading,
        anomalyDetected: reading.isAnomalous,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This reading is for informational purposes only, NOT medical advice."
      });
    } catch (error) {
      console.error("[IoT Routes] Error adding reading:", error);
      res.status(500).json({ error: "Failed to add reading" });
    }
  });

  app.post("/api/iot-sensors/readings/detect-anomaly", async (req, res) => {
    try {
      const { sensorType, values } = req.body;
      
      if (!sensorType || !values) {
        return res.status(400).json({ error: "sensorType and values are required" });
      }
      
      const result = await iotHealthSensorService.detectAnomaly(sensorType, values);
      res.json(result);
    } catch (error) {
      console.error("[IoT Routes] Error detecting anomaly:", error);
      res.status(500).json({ error: "Failed to detect anomaly" });
    }
  });

  app.get("/api/iot-sensors/alerts", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const options = {
        status: req.query.status as AlertStatus | undefined,
        severity: req.query.severity as AlertSeverity | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };
      
      const alerts = await iotHealthSensorService.getAlerts(patientId, options);
      res.json({
        success: true,
        alerts,
        count: alerts.length,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. These alerts are for informational purposes only, NOT medical advice."
      });
    } catch (error) {
      console.error("[IoT Routes] Error getting alerts:", error);
      res.status(500).json({ error: "Failed to get alerts" });
    }
  });

  app.post("/api/iot-sensors/alerts/:alertId/acknowledge", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const userId = user?.claims?.sub || "user-001";
      const { alertId } = req.params;
      
      const alert = await iotHealthSensorService.acknowledgeAlert(patientId, alertId, userId);
      
      if (alert) {
        res.json({ success: true, alert, message: "Alert acknowledged" });
      } else {
        res.status(404).json({ error: "Alert not found or already acknowledged" });
      }
    } catch (error) {
      console.error("[IoT Routes] Error acknowledging alert:", error);
      res.status(500).json({ error: "Failed to acknowledge alert" });
    }
  });

  app.post("/api/iot-sensors/alerts/:alertId/resolve", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const userId = user?.claims?.sub || "user-001";
      const { alertId } = req.params;
      
      const alert = await iotHealthSensorService.resolveAlert(patientId, alertId, userId);
      
      if (alert) {
        res.json({ success: true, alert, message: "Alert resolved" });
      } else {
        res.status(404).json({ error: "Alert not found or already resolved" });
      }
    } catch (error) {
      console.error("[IoT Routes] Error resolving alert:", error);
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  app.post("/api/iot-sensors/alerts/:alertId/escalate", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const { alertId } = req.params;
      
      const parsed = z.object({ escalateTo: z.string().min(1) }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "escalateTo is required" });
      }
      
      const alert = await iotHealthSensorService.escalateAlert(patientId, alertId, parsed.data.escalateTo);
      
      if (alert) {
        res.json({ success: true, alert, message: `Alert escalated to ${parsed.data.escalateTo}` });
      } else {
        res.status(404).json({ error: "Alert not found" });
      }
    } catch (error) {
      console.error("[IoT Routes] Error escalating alert:", error);
      res.status(500).json({ error: "Failed to escalate alert" });
    }
  });

  app.post("/api/iot-sensors/streams/start", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const parsed = streamActionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "sensorId is required" });
      }
      
      const stream = await iotHealthSensorService.startRealTimeStream(patientId, parsed.data.sensorId);
      res.json({
        success: true,
        stream,
        message: "Real-time stream started"
      });
    } catch (error) {
      console.error("[IoT Routes] Error starting stream:", error);
      res.status(500).json({ error: "Failed to start stream" });
    }
  });

  app.post("/api/iot-sensors/streams/:streamId/stop", async (req, res) => {
    try {
      const { streamId } = req.params;
      
      const success = await iotHealthSensorService.stopRealTimeStream(streamId);
      
      if (success) {
        res.json({ success: true, message: "Stream stopped" });
      } else {
        res.status(404).json({ error: "Stream not found" });
      }
    } catch (error) {
      console.error("[IoT Routes] Error stopping stream:", error);
      res.status(500).json({ error: "Failed to stop stream" });
    }
  });

  app.get("/api/iot-sensors/streams/:streamId", async (req, res) => {
    try {
      const { streamId } = req.params;
      
      const stream = await iotHealthSensorService.getStreamData(streamId);
      
      if (stream) {
        res.json({
          success: true,
          stream,
          noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Stream data is for informational purposes only, NOT medical advice."
        });
      } else {
        res.status(404).json({ error: "Stream not found" });
      }
    } catch (error) {
      console.error("[IoT Routes] Error getting stream:", error);
      res.status(500).json({ error: "Failed to get stream" });
    }
  });

  app.get("/api/iot-sensors/analytics/trends", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const sensorType = req.query.sensorType as SensorType;
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      
      if (!sensorType) {
        return res.status(400).json({ error: "sensorType is required" });
      }
      
      const analysis = await iotHealthSensorService.getTrendAnalysis(patientId, sensorType, days);
      res.json(analysis);
    } catch (error) {
      console.error("[IoT Routes] Error getting trends:", error);
      res.status(500).json({ error: "Failed to get trend analysis" });
    }
  });

  console.log("[Routes] IoT Health Sensor routes registered at /api/iot-sensors/*");
  console.log("[Routes] - Dashboard: GET /api/iot-sensors/dashboard");
  console.log("[Routes] - Sensors: GET/POST /api/iot-sensors/sensors/*");
  console.log("[Routes] - Readings: GET/POST /api/iot-sensors/readings");
  console.log("[Routes] - Anomaly Detection: POST /api/iot-sensors/readings/detect-anomaly");
  console.log("[Routes] - Alerts: GET/POST /api/iot-sensors/alerts/*");
  console.log("[Routes] - Streams: POST /api/iot-sensors/streams/*");
  console.log("[Routes] - Analytics: GET /api/iot-sensors/analytics/trends");
}
