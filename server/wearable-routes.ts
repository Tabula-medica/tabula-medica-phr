import type { Express } from "express";
import { wearableIntegrationService, type WearableProvider } from "./services/wearable-integration-service";
import { z } from "zod";

const connectDeviceSchema = z.object({
  provider: z.enum(["fitbit", "apple_health", "google_fit", "garmin", "samsung_health"]),
  authCode: z.string().min(1)
});

const syncDeviceSchema = z.object({
  deviceId: z.string().min(1)
});

const disconnectDeviceSchema = z.object({
  deviceId: z.string().min(1)
});

export function registerWearableRoutes(app: Express): void {
  app.get("/api/wearables/devices", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const devices = await wearableIntegrationService.getConnectedDevices(patientId);
      res.json({
        success: true,
        devices,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Wearable device data is for informational purposes only, NOT medical advice."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting devices:", error);
      res.status(500).json({ error: "Failed to get connected devices" });
    }
  });

  app.post("/api/wearables/connect", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const parsed = connectDeviceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.errors });
      }

      const device = await wearableIntegrationService.connectDevice(
        patientId,
        parsed.data.provider,
        parsed.data.authCode
      );

      res.json({
        success: true,
        device,
        message: `Successfully connected ${device.name}`
      });
    } catch (error) {
      console.error("[Wearable Routes] Error connecting device:", error);
      res.status(500).json({ error: "Failed to connect device" });
    }
  });

  app.post("/api/wearables/disconnect", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const parsed = disconnectDeviceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }

      const success = await wearableIntegrationService.disconnectDevice(patientId, parsed.data.deviceId);
      
      if (success) {
        res.json({ success: true, message: "Device disconnected" });
      } else {
        res.status(404).json({ error: "Device not found" });
      }
    } catch (error) {
      console.error("[Wearable Routes] Error disconnecting device:", error);
      res.status(500).json({ error: "Failed to disconnect device" });
    }
  });

  app.post("/api/wearables/sync", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const parsed = syncDeviceSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request" });
      }

      const device = await wearableIntegrationService.syncDevice(patientId, parsed.data.deviceId);
      
      if (device) {
        res.json({ success: true, device, message: "Sync completed" });
      } else {
        res.status(404).json({ error: "Device not found" });
      }
    } catch (error) {
      console.error("[Wearable Routes] Error syncing device:", error);
      res.status(500).json({ error: "Failed to sync device" });
    }
  });

  app.get("/api/wearables/oauth-url/:provider", async (req, res) => {
    try {
      const provider = req.params.provider as WearableProvider;
      const redirectUri = `${req.protocol}://${req.get('host')}/wearable-callback`;
      
      const url = wearableIntegrationService.getOAuthUrl(provider, redirectUri);
      res.json({ success: true, url, provider });
    } catch (error) {
      console.error("[Wearable Routes] Error getting OAuth URL:", error);
      res.status(500).json({ error: "Failed to get OAuth URL" });
    }
  });

  app.get("/api/wearables/summary", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const summary = await wearableIntegrationService.getSummary(patientId);
      res.json({
        success: true,
        summary,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This summary is for informational purposes only, NOT medical advice."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting summary:", error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  });

  app.get("/api/wearables/steps", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const days = parseInt(req.query.days as string) || 30;
      
      const data = await wearableIntegrationService.getStepsData(patientId, days);
      res.json({
        success: true,
        data,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Step data is for informational purposes only."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting steps:", error);
      res.status(500).json({ error: "Failed to get steps data" });
    }
  });

  app.get("/api/wearables/sleep", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const days = parseInt(req.query.days as string) || 30;
      
      const data = await wearableIntegrationService.getSleepData(patientId, days);
      res.json({
        success: true,
        data,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Sleep data is for informational purposes only."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting sleep:", error);
      res.status(500).json({ error: "Failed to get sleep data" });
    }
  });

  app.get("/api/wearables/heart-rate", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const days = parseInt(req.query.days as string) || 7;
      
      const data = await wearableIntegrationService.getHeartRateData(patientId, days);
      res.json({
        success: true,
        data,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Heart rate data is for informational purposes only."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting heart rate:", error);
      res.status(500).json({ error: "Failed to get heart rate data" });
    }
  });

  app.get("/api/wearables/hrv", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const days = parseInt(req.query.days as string) || 30;
      
      const data = await wearableIntegrationService.getHrvData(patientId, days);
      res.json({
        success: true,
        data,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. HRV data is for informational purposes only."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting HRV:", error);
      res.status(500).json({ error: "Failed to get HRV data" });
    }
  });

  app.get("/api/wearables/activity", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      const days = parseInt(req.query.days as string) || 30;
      
      const data = await wearableIntegrationService.getActivityData(patientId, days);
      res.json({
        success: true,
        data,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Activity data is for informational purposes only."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting activity:", error);
      res.status(500).json({ error: "Failed to get activity data" });
    }
  });

  app.get("/api/wearables/correlations", async (req, res) => {
    try {
      const user = req.user as any;
      const patientId = user?.claims?.sub || "patient-001";
      
      const correlations = await wearableIntegrationService.getHealthCorrelations(patientId);
      res.json({
        success: true,
        correlations,
        noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. Health correlations are for educational purposes only and do NOT constitute medical advice. Always consult with your healthcare provider."
      });
    } catch (error) {
      console.error("[Wearable Routes] Error getting correlations:", error);
      res.status(500).json({ error: "Failed to get health correlations" });
    }
  });

  console.log("[Routes] Wearable Integration routes registered at /api/wearables/*");
}
