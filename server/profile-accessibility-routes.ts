import { Router, Request, Response } from "express";
import crypto from "crypto";
import type { ProfileAccessibilitySettings } from "@shared/schema";
import { insertProfileAccessibilitySettingsSchema } from "@shared/schema";

const router = Router();

const profileAccessibilitySettings = new Map<string, ProfileAccessibilitySettings>();

function hashForAudit(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function logHIPAAAudit(operation: string, details: Record<string, unknown>, req: Request) {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    userId: hashForAudit(req.ip || "anonymous"),
    ipAddress: hashForAudit(req.ip || "unknown"),
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    category: "PROFILE_ACCESSIBILITY",
  };
  console.log("[HIPAA-AUDIT][PROFILE-ACCESSIBILITY]", JSON.stringify(auditEntry));
}

function getDefaultSettings(profileId: string): ProfileAccessibilitySettings {
  return {
    id: `pas-${profileId}`,
    profileId,
    simplifiedMode: false,
    largeText: false,
    highContrast: false,
    reducedMotion: false,
    fontSize: "normal",
    simpleLanguage: false,
    screenReaderOptimized: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

router.get("/api/profiles/:profileId/accessibility", (req: Request, res: Response) => {
  const { profileId } = req.params;
  
  let settings = profileAccessibilitySettings.get(profileId);
  if (!settings) {
    settings = getDefaultSettings(profileId);
    profileAccessibilitySettings.set(profileId, settings);
  }
  
  logHIPAAAudit("READ_ACCESSIBILITY_SETTINGS", { profileId }, req);
  
  res.json(settings);
});

router.put("/api/profiles/:profileId/accessibility", (req: Request, res: Response) => {
  const { profileId } = req.params;
  
  try {
    const validatedData = insertProfileAccessibilitySettingsSchema.parse({
      ...req.body,
      profileId,
    });
    
    const existingSettings = profileAccessibilitySettings.get(profileId);
    const now = new Date().toISOString();
    
    const settings: ProfileAccessibilitySettings = {
      id: existingSettings?.id || `pas-${profileId}`,
      profileId,
      simplifiedMode: validatedData.simplifiedMode ?? false,
      largeText: validatedData.largeText ?? false,
      highContrast: validatedData.highContrast ?? false,
      reducedMotion: validatedData.reducedMotion ?? false,
      fontSize: validatedData.fontSize ?? "normal",
      simpleLanguage: validatedData.simpleLanguage ?? false,
      screenReaderOptimized: validatedData.screenReaderOptimized ?? false,
      createdAt: existingSettings?.createdAt || now,
      updatedAt: now,
    };
    
    profileAccessibilitySettings.set(profileId, settings);
    
    logHIPAAAudit("UPDATE_ACCESSIBILITY_SETTINGS", { profileId, changedSettings: Object.keys(req.body) }, req);
    
    res.json(settings);
  } catch (error) {
    res.status(400).json({ error: "Invalid accessibility settings" });
  }
});

router.patch("/api/profiles/:profileId/accessibility/simplified-mode", (req: Request, res: Response) => {
  const { profileId } = req.params;
  const { enabled } = req.body;
  
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled must be a boolean" });
  }
  
  let settings = profileAccessibilitySettings.get(profileId);
  if (!settings) {
    settings = getDefaultSettings(profileId);
  }
  
  settings = {
    ...settings,
    simplifiedMode: enabled,
    updatedAt: new Date().toISOString(),
  };
  
  profileAccessibilitySettings.set(profileId, settings);
  
  logHIPAAAudit("TOGGLE_SIMPLIFIED_MODE", { profileId, simplifiedMode: enabled }, req);
  
  res.json(settings);
});

export default router;
