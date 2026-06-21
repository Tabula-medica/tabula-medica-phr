import { Router } from "express";
import * as voiceNav from "./services/multilingual-voice-navigation-service";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][VoiceNavRoutes] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

router.get("/api/voice-navigation/languages", async (req, res) => {
  try {
    const languages = voiceNav.getSupportedLanguages();
    res.json({ success: true, data: languages });
  } catch (error) {
    console.error("[VoiceNav] Get languages error:", error);
    res.status(500).json({ success: false, error: "Failed to get supported languages" });
  }
});

router.post("/api/voice-navigation/settings/init", async (req, res) => {
  try {
    const { userId, language = "en" } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const settings = voiceNav.initializeUserSettings(userId, language);
    logHipaaAudit("INIT_SETTINGS", userId, `Initialized voice navigation settings`);

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("[VoiceNav] Init settings error:", error);
    res.status(500).json({ success: false, error: "Failed to initialize settings" });
  }
});

router.get("/api/voice-navigation/settings/:userId", async (req, res) => {
  try {
    const settings = voiceNav.getUserSettings(req.params.userId);
    if (!settings) {
      return res.status(404).json({ success: false, error: "Settings not found" });
    }

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("[VoiceNav] Get settings error:", error);
    res.status(500).json({ success: false, error: "Failed to get settings" });
  }
});

router.patch("/api/voice-navigation/settings/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;

    const settings = voiceNav.updateUserSettings(userId, updates);
    if (!settings) {
      return res.status(404).json({ success: false, error: "Settings not found" });
    }

    logHipaaAudit("UPDATE_SETTINGS", userId, `Updated voice settings`);
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("[VoiceNav] Update settings error:", error);
    res.status(500).json({ success: false, error: "Failed to update settings" });
  }
});

router.post("/api/voice-navigation/command", async (req, res) => {
  try {
    const { userId, transcript, language = "en" } = req.body;

    if (!userId || !transcript) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: userId, transcript",
      });
    }

    logHipaaAudit("PROCESS_COMMAND", userId, `Processing voice command in ${language}`);

    const response = await voiceNav.processVoiceCommand(userId, transcript, language);

    res.json({ success: true, data: response });
  } catch (error) {
    console.error("[VoiceNav] Process command error:", error);
    res.status(500).json({ success: false, error: "Failed to process voice command" });
  }
});

router.get("/api/voice-navigation/screen-reader/:route", async (req, res) => {
  try {
    const route = decodeURIComponent(req.params.route);
    const language = (req.query.language as string) || "en";

    const content = voiceNav.generateScreenReaderContent(route, language as any);

    res.json({ success: true, data: content });
  } catch (error) {
    console.error("[VoiceNav] Screen reader content error:", error);
    res.status(500).json({ success: false, error: "Failed to get screen reader content" });
  }
});

router.get("/api/voice-navigation/history/:userId", async (req, res) => {
  try {
    const history = voiceNav.getCommandHistory(req.params.userId);
    logHipaaAudit("VIEW_HISTORY", req.params.userId, `Retrieved ${history.length} commands`);

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("[VoiceNav] Get history error:", error);
    res.status(500).json({ success: false, error: "Failed to get command history" });
  }
});

export function registerVoiceNavigationRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Multilingual Voice Navigation routes registered at /api/voice-navigation/*");
}

export default router;
