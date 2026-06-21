import { Router } from "express";
import * as accessibilityService from "./services/accessibility-population-service";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][AccessibilityRoutes] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

router.get("/api/accessibility/populations", async (req, res) => {
  try {
    const populations = accessibilityService.getSupportedPopulations();
    res.json({ success: true, data: populations });
  } catch (error) {
    console.error("[Accessibility] Get populations error:", error);
    res.status(500).json({ success: false, error: "Failed to get populations" });
  }
});

router.get("/api/accessibility/disability-types", async (req, res) => {
  try {
    const types = accessibilityService.getSupportedDisabilityTypes();
    res.json({ success: true, data: types });
  } catch (error) {
    console.error("[Accessibility] Get disability types error:", error);
    res.status(500).json({ success: false, error: "Failed to get disability types" });
  }
});

router.post("/api/accessibility/settings/init", async (req, res) => {
  try {
    const { userId, population = "general", language = "en" } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const settings = accessibilityService.initializeAccessibilitySettings(userId, population, language);
    logHipaaAudit("INIT_SETTINGS", userId, `Initialized accessibility settings for ${population}`);

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("[Accessibility] Init settings error:", error);
    res.status(500).json({ success: false, error: "Failed to initialize settings" });
  }
});

router.get("/api/accessibility/settings/:userId", async (req, res) => {
  try {
    const settings = accessibilityService.getAccessibilitySettings(req.params.userId);
    if (!settings) {
      return res.status(404).json({ success: false, error: "Settings not found" });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("[Accessibility] Get settings error:", error);
    res.status(500).json({ success: false, error: "Failed to get settings" });
  }
});

router.patch("/api/accessibility/settings/:userId", async (req, res) => {
  try {
    const updates = req.body;
    const settings = accessibilityService.updateAccessibilitySettings(req.params.userId, updates);

    if (!settings) {
      return res.status(404).json({ success: false, error: "Settings not found" });
    }

    logHipaaAudit("UPDATE_SETTINGS", req.params.userId, `Updated accessibility settings`);
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("[Accessibility] Update settings error:", error);
    res.status(500).json({ success: false, error: "Failed to update settings" });
  }
});

router.post("/api/accessibility/profile/init", async (req, res) => {
  try {
    const { userId, populationType = "general", age } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "Missing userId" });
    }

    const profile = accessibilityService.initializePopulationProfile(userId, populationType, age);
    logHipaaAudit("INIT_PROFILE", userId, `Initialized ${populationType} population profile`);

    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[Accessibility] Init profile error:", error);
    res.status(500).json({ success: false, error: "Failed to initialize profile" });
  }
});

router.get("/api/accessibility/profile/:userId", async (req, res) => {
  try {
    const profile = accessibilityService.getPopulationProfile(req.params.userId);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[Accessibility] Get profile error:", error);
    res.status(500).json({ success: false, error: "Failed to get profile" });
  }
});

router.patch("/api/accessibility/profile/:userId", async (req, res) => {
  try {
    const updates = req.body;
    const profile = accessibilityService.updatePopulationProfile(req.params.userId, updates);

    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    logHipaaAudit("UPDATE_PROFILE", req.params.userId, `Updated population profile`);
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[Accessibility] Update profile error:", error);
    res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

router.get("/api/accessibility/ui/:population", async (req, res) => {
  try {
    const ui = accessibilityService.getPopulationUI(req.params.population as any);
    res.json({ success: true, data: ui });
  } catch (error) {
    console.error("[Accessibility] Get UI error:", error);
    res.status(500).json({ success: false, error: "Failed to get UI configuration" });
  }
});

router.post("/api/accessibility/profile/:userId/emergency-contact", async (req, res) => {
  try {
    const contact = accessibilityService.addEmergencyContact(req.params.userId, req.body);

    if (!contact) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    logHipaaAudit("ADD_EMERGENCY_CONTACT", req.params.userId, `Added emergency contact`);
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error("[Accessibility] Add emergency contact error:", error);
    res.status(500).json({ success: false, error: "Failed to add emergency contact" });
  }
});

router.post("/api/accessibility/profile/:userId/care-team-contact", async (req, res) => {
  try {
    const contact = accessibilityService.addCareTeamContact(req.params.userId, req.body);

    if (!contact) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    logHipaaAudit("ADD_CARE_TEAM_CONTACT", req.params.userId, `Added care team contact`);
    res.json({ success: true, data: contact });
  } catch (error) {
    console.error("[Accessibility] Add care team contact error:", error);
    res.status(500).json({ success: false, error: "Failed to add care team contact" });
  }
});

router.post("/api/accessibility/simplify-content", async (req, res) => {
  try {
    const { content, readingLevel = "simple", language = "en" } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: "Missing content" });
    }

    const simplified = await accessibilityService.generateSimplifiedContent(content, readingLevel, language);
    res.json({ success: true, data: { original: content, simplified, readingLevel } });
  } catch (error) {
    console.error("[Accessibility] Simplify content error:", error);
    res.status(500).json({ success: false, error: "Failed to simplify content" });
  }
});

export function registerAccessibilityPopulationRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Accessibility & Population routes registered at /api/accessibility/*");
}

export default router;
